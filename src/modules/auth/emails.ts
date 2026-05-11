import "server-only"
import { EmailType, EmailStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { emailProvider } from "@/lib/email"
import { env } from "@/lib/env"
import { renderEmail } from "@/lib/email/template"
import { createUserToken } from "./tokens"

/**
 * Plantillas y envío de emails de autenticación: activación de cuenta y
 * recuperación de contraseña.
 *
 * Ambos comparten el mismo modelo (token a un solo uso → form para setear
 * contraseña). Las plantillas están en HTML con estilos inline porque los
 * clientes de email no soportan stylesheets.
 *
 * Persistimos cada envío en `EmailNotification` para audit trail. El send
 * NO debe vivir dentro de una transacción Prisma — llamar después del
 * commit.
 */

type Kind = "activation" | "reset" | "deactivation"

type DeliverArgs = {
  to: string
  subject: string
  html: string
  userId: string
  kind: Kind
}

/**
 * Persiste el envío en `EmailNotification` antes de despachar para que el
 * retry job pueda reintentarlo si falla. El HTML completo va a
 * `templateData.html` para no tener que reconstruirlo en el reintento.
 */
async function deliverEmail(args: DeliverArgs): Promise<{ ok: boolean }> {
  const notif = await prisma.emailNotification.create({
    data: {
      to: args.to,
      subject: args.subject,
      type: EmailType.GENERIC,
      templateData: {
        kind: args.kind,
        html: args.html,
        from: env.EMAIL_FROM,
        replyTo: env.EMAIL_REPLY_TO ?? null,
      },
      status: EmailStatus.QUEUED,
      userId: args.userId,
    },
  })

  try {
    await emailProvider().send({
      to: args.to,
      subject: args.subject,
      html: args.html,
      from: env.EMAIL_FROM,
      replyTo: env.EMAIL_REPLY_TO,
    })
    await prisma.emailNotification.update({
      where: { id: notif.id },
      data: { status: EmailStatus.SENT, sentAt: new Date(), attempts: 1 },
    })
    return { ok: true }
  } catch (err) {
    await prisma.emailNotification.update({
      where: { id: notif.id },
      data: {
        status: EmailStatus.FAILED,
        error: err instanceof Error ? err.message : String(err),
        attempts: 1,
      },
    })
    return { ok: false }
  }
}

// -----------------------------------------------------------------------------
//  URLs
// -----------------------------------------------------------------------------

function buildActivationLink(token: string): string {
  return `${env.AUTH_URL.replace(/\/$/, "")}/activar/${token}`
}

function buildResetLink(token: string): string {
  return `${env.AUTH_URL.replace(/\/$/, "")}/recuperar/${token}`
}

// -----------------------------------------------------------------------------
//  Funciones públicas
// -----------------------------------------------------------------------------

export async function sendActivationEmail(args: {
  userId: string
  email: string
  firstName: string
  token: string
}): Promise<{ ok: boolean }> {
  const html = renderEmail({
    preheader: "Define tu contraseña para activar tu cuenta.",
    eyebrow: "Activación de cuenta",
    heading: `Hola, ${args.firstName}`,
    body: [
      "Tu cuenta en CM English Instructor está lista. Para entrar por primera vez, define tu contraseña con el siguiente enlace.",
    ],
    cta: { label: "Activar cuenta", url: buildActivationLink(args.token) },
    fineprint:
      "Este enlace vence en 7 días. Si no esperabas este correo, puedes ignorarlo sin que pase nada.",
  })
  return deliverEmail({
    to: args.email,
    subject: "Activa tu cuenta en CM English Instructor",
    html,
    userId: args.userId,
    kind: "activation",
  })
}

export async function sendPasswordResetEmail(args: {
  userId: string
  email: string
  firstName: string
  token: string
}): Promise<{ ok: boolean }> {
  const html = renderEmail({
    preheader: "Restablece la contraseña de tu cuenta.",
    eyebrow: "Restablecer contraseña",
    heading: `Hola, ${args.firstName}`,
    body: [
      "Recibimos una solicitud para restablecer tu contraseña. Si fuiste tú, usa el siguiente enlace para crear una nueva.",
    ],
    cta: {
      label: "Restablecer contraseña",
      url: buildResetLink(args.token),
    },
    fineprint:
      "Este enlace vence en 1 hora. Si no solicitaste el cambio, puedes ignorar este correo — tu contraseña actual seguirá funcionando.",
  })
  return deliverEmail({
    to: args.email,
    subject: "Restablece tu contraseña",
    html,
    userId: args.userId,
    kind: "reset",
  })
}

/**
 * Email de cortesía cuando admin desactiva una cuenta. No incluye CTA — la
 * cuenta está cerrada y no hay acción que el usuario pueda tomar
 * directamente; lo que corresponde es contactar a coordinación.
 */
export async function sendDeactivationEmail(args: {
  userId: string
  email: string
  firstName: string
}): Promise<{ ok: boolean }> {
  const html = renderEmail({
    preheader: "Tu acceso a la plataforma fue desactivado.",
    eyebrow: "Acceso desactivado",
    heading: `Hola, ${args.firstName}`,
    body: [
      "Te avisamos que tu acceso a la plataforma de CM English Instructor fue desactivado. Mientras tu cuenta esté en este estado, no podrás iniciar sesión.",
      "Si crees que es un error o quieres retomar tus clases, escríbenos respondiendo a este correo y lo revisamos.",
    ],
    fineprint:
      "Tu información queda preservada — si reactivamos la cuenta, todo vuelve a estar disponible donde lo dejaste.",
  })
  return deliverEmail({
    to: args.email,
    subject: "Tu cuenta fue desactivada",
    html,
    userId: args.userId,
    kind: "deactivation",
  })
}

// -----------------------------------------------------------------------------
//  Wrappers que combinan token + envío
// -----------------------------------------------------------------------------

export async function issueAndSendActivation(args: {
  userId: string
  email: string
  firstName: string
}): Promise<{ ok: boolean; reason?: "rate_limited" | "send_failed" }> {
  const created = await createUserToken(args.userId, "activation")
  if ("rateLimited" in created) return { ok: false, reason: "rate_limited" }
  const sent = await sendActivationEmail({
    userId: args.userId,
    email: args.email,
    firstName: args.firstName,
    token: created.token,
  })
  return sent.ok ? { ok: true } : { ok: false, reason: "send_failed" }
}

export async function issueAndSendPasswordReset(args: {
  userId: string
  email: string
  firstName: string
  rateLimit?: boolean
}): Promise<{ ok: boolean; reason?: "rate_limited" | "send_failed" }> {
  const created = await createUserToken(args.userId, "reset", {
    rateLimit: args.rateLimit ?? true,
  })
  if ("rateLimited" in created) return { ok: false, reason: "rate_limited" }
  const sent = await sendPasswordResetEmail({
    userId: args.userId,
    email: args.email,
    firstName: args.firstName,
    token: created.token,
  })
  return sent.ok ? { ok: true } : { ok: false, reason: "send_failed" }
}
