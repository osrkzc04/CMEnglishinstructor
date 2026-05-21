import "server-only"
import { EmailType, EmailStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { env } from "@/lib/env"
import { renderEmail } from "@/lib/email/template"

/**
 * Emails del flujo de placement test: invitación, recordatorio (futuro),
 * resultado listo y entrega al candidato.
 *
 * Mismo patrón que `auth/emails.ts`: persistir HTML pre-renderizado en
 * `EmailNotification.templateData.html` con status QUEUED y disparar el
 * flush asíncrono. El scheduler periódico levanta los rezagados.
 */

type DeliverArgs = {
  to: string
  subject: string
  html: string
  type: EmailType
  inviteId?: string
  sessionId?: string
}

async function deliverEmail(args: DeliverArgs): Promise<{ ok: boolean }> {
  const created = await prisma.emailNotification.create({
    data: {
      to: args.to,
      subject: args.subject,
      type: args.type,
      templateData: {
        html: args.html,
        from: env.EMAIL_FROM,
        replyTo: env.EMAIL_REPLY_TO ?? null,
      },
      status: EmailStatus.QUEUED,
      inviteId: args.inviteId ?? null,
      sessionId: args.sessionId ?? null,
    },
    select: { id: true },
  })

  // Flush dirigido: enviamos SOLO este email. Antes invocábamos
  // `retryFailedEmails()` (flush global) y eso causaba que cualquier email
  // viejo en QUEUED/FAILED para otro destinatario o de otro tipo (ej. una
  // activación de cuenta pendiente) se enviara como efecto colateral al
  // crear la invitación de prueba. El cron periódico sigue recogiendo
  // rezagados de la cola.
  setImmediate(() => {
    void import("@/modules/auth/retryFailedEmails")
      .then(({ sendNotificationById }) => sendNotificationById(created.id))
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error("[email-queue] background send error:", e)
      })
  })

  return { ok: true }
}

// -----------------------------------------------------------------------------
//  URLs
// -----------------------------------------------------------------------------

export function buildTestInviteLink(token: string): string {
  return `${env.AUTH_URL.replace(/\/$/, "")}/prueba/${token}`
}

export function buildTestResultsLink(token: string): string {
  return `${env.AUTH_URL.replace(/\/$/, "")}/resultados/${token}`
}

// -----------------------------------------------------------------------------
//  Invitación a rendir la prueba
// -----------------------------------------------------------------------------

export async function sendTestInvitationEmail(args: {
  inviteId: string
  to: string
  candidateName: string
  token: string
  expiresAt: Date
  timeLimitMinutes: number
}): Promise<{ ok: boolean }> {
  const link = buildTestInviteLink(args.token)
  const expiresLabel = formatExpires(args.expiresAt)

  const html = renderEmail({
    preheader: "Tu evaluación de ubicación está lista.",
    eyebrow: "Evaluación de ubicación",
    heading: `Hola, ${args.candidateName}`,
    body: [
      "Te invitamos a rendir la evaluación de ubicación. Cuando estés listo, abre el enlace y completa la evaluación en una sola sesión.",
      `La evaluación toma alrededor de ${args.timeLimitMinutes} minutos. Necesitas conexión estable a internet y un dispositivo donde puedas trabajar sin interrupciones — una vez que la inicies, queda asociada a ese dispositivo.`,
      `Este enlace pierde validez el ${expiresLabel}. Si no llegas a tiempo, escríbenos y te enviamos uno nuevo.`,
    ],
    cta: { label: "Iniciar evaluación", url: link },
    fineprint: `Si el botón no funciona, copia y pega este enlace en tu navegador:\n${link}`,
  })

  return deliverEmail({
    to: args.to,
    subject: "Tu evaluación de ubicación está lista",
    html,
    type: EmailType.TEST_INVITATION,
    inviteId: args.inviteId,
  })
}

// -----------------------------------------------------------------------------
//  Entrega de resultados al candidato (post-revisión humana)
// -----------------------------------------------------------------------------

/**
 * Envía al candidato el resumen de su evaluación con un link de 12 h.
 *
 * Copy neutra: no se menciona "aprobado/reprobado" ni nivel CEFR — esa
 * conversación la maneja coordinación por fuera. Solo invitamos a abrir el
 * link para ver su retroalimentación.
 */
export async function sendTestResultsEmail(args: {
  sessionId: string
  to: string
  candidateName: string
  resultsToken: string
  expiresAt: Date
}): Promise<{ ok: boolean }> {
  const link = buildTestResultsLink(args.resultsToken)
  const expiresLabel = formatExpires(args.expiresAt)

  const html = renderEmail({
    preheader: "Tu evaluación ya fue revisada.",
    eyebrow: "Resultado de tu evaluación",
    heading: `Hola, ${args.candidateName}`,
    body: [
      "Tu evaluación de ubicación ya fue revisada. Puedes abrir el enlace para ver el resultado y las observaciones.",
      `El enlace queda disponible hasta el ${expiresLabel}. Después de esa fecha vence por seguridad — si necesitas verlo más tarde, escríbenos y te ayudamos.`,
    ],
    cta: { label: "Ver mi resultado", url: link },
    fineprint: `Si el botón no funciona, copia y pega este enlace en tu navegador:\n${link}`,
  })

  return deliverEmail({
    to: args.to,
    subject: "Resultado de tu evaluación de ubicación",
    html,
    type: EmailType.TEST_RESULT_STUDENT,
    sessionId: args.sessionId,
  })
}

// -----------------------------------------------------------------------------
//  Helpers
// -----------------------------------------------------------------------------

const expiresFormatter = new Intl.DateTimeFormat("es-EC", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
})

function formatExpires(d: Date): string {
  return expiresFormatter.format(d)
}
