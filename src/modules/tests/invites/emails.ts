import "server-only"
import { EmailType, EmailStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { env } from "@/lib/env"
import { renderEmail, EMAIL_COLORS, EMAIL_FONTS } from "@/lib/email/template"
import { PLACEMENT_SKILL_MAX, PLACEMENT_TOTAL_MAX } from "@/modules/tests/grading/level-recommendation"

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
export type PlacementScores = {
  reading: number | null
  writing: number | null
  listening: number | null
  speaking: number | null
}

export async function sendTestResultsEmail(args: {
  sessionId: string
  to: string
  candidateName: string
  resultsToken: string
  expiresAt: Date
  scores?: PlacementScores
  writingFeedback?: string | null
}): Promise<{ ok: boolean }> {
  const link = buildTestResultsLink(args.resultsToken)
  const expiresLabel = formatExpires(args.expiresAt)

  const scoresTable = args.scores ? renderScoresTable(args.scores) : ""
  const writingBlock = args.writingFeedback ? renderWritingFeedback(args.writingFeedback) : ""

  const html = renderEmail({
    preheader: "Tu evaluación ya fue revisada.",
    eyebrow: "Resultado de tu evaluación",
    heading: `Hola, ${args.candidateName}`,
    blocks: [
      {
        kind: "p",
        html: "Tu evaluación de ubicación ya fue revisada. Estos son tus puntajes por habilidad:",
      },
      ...(scoresTable ? [{ kind: "raw" as const, html: scoresTable }] : []),
      ...(writingBlock ? [{ kind: "raw" as const, html: writingBlock }] : []),
      {
        kind: "p",
        html: "Abre el enlace para ver el detalle de tus respuestas y las observaciones de coordinación.",
      },
      {
        kind: "p",
        html: `El enlace queda disponible hasta el ${escapeText(expiresLabel)}. Después de esa fecha vence por seguridad — si necesitas verlo más tarde, escríbenos y te ayudamos.`,
      },
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
//  Tabla de puntajes (HTML inline para el correo)
// -----------------------------------------------------------------------------

function renderScoresTable(scores: PlacementScores): string {
  const rows: { label: string; value: number | null }[] = [
    { label: "Reading / Grammar", value: scores.reading },
    { label: "Writing", value: scores.writing },
    { label: "Listening", value: scores.listening },
    { label: "Speaking", value: scores.speaking },
  ]
  const total = rows.reduce((sum, r) => sum + (r.value ?? 0), 0)

  const C = EMAIL_COLORS
  const F = EMAIL_FONTS

  const cellLabel = `font-family:${F.sans};font-size:14px;color:${C.body};padding:11px 0;border-bottom:1px solid ${C.border};`
  const cellValue = `font-family:${F.mono};font-size:14px;color:${C.ink};text-align:right;padding:11px 0;border-bottom:1px solid ${C.border};`

  const body = rows
    .map(
      (r) => `<tr>
        <td style="${cellLabel}">${escapeText(r.label)}</td>
        <td style="${cellValue}">${r.value === null ? "—" : `${formatScore(r.value)} / ${PLACEMENT_SKILL_MAX}`}</td>
      </tr>`,
    )
    .join("")

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;border:1px solid ${C.border};border-radius:10px;padding:6px 18px;background:${C.bone};">
      ${body}
      <tr>
        <td style="font-family:${F.sans};font-size:14px;font-weight:600;color:${C.ink};padding:13px 0 11px 0;">Total</td>
        <td style="font-family:${F.mono};font-size:16px;font-weight:600;color:${C.teal};text-align:right;padding:13px 0 11px 0;">${total} / ${PLACEMENT_TOTAL_MAX}</td>
      </tr>
    </table>`
}

function renderWritingFeedback(text: string): string {
  const C = EMAIL_COLORS
  const F = EMAIL_FONTS
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
      <tr>
        <td style="border-left:3px solid ${C.teal};padding:4px 0 4px 16px;">
          <p style="margin:0 0 6px 0;font-family:${F.sans};font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${C.textMuted};">Sobre tu redacción</p>
          <p style="margin:0;font-family:${F.sans};font-size:14px;line-height:1.6;color:${C.body};">${escapeText(text).replace(/\n/g, "<br>")}</p>
        </td>
      </tr>
    </table>`
}

function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
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
