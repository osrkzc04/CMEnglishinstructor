import "server-only"
import { EmailType, EmailStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { emailProvider } from "@/lib/email"
import { env } from "@/lib/env"
import { renderEmail } from "@/lib/email/template"
import { InquiryTopicLabel, type InquiryTopic } from "./publicSchemas"

/**
 * Envío del correo de notificación interna cuando alguien usa el form de
 * contacto del landing. Destino: `EMAIL_REPLY_TO` (mismo buzón que reciben
 * las respuestas de los acuses transaccionales).
 *
 * El header `Reply-To` se cablea al correo del visitante, así coordinación
 * solo aprieta "Responder" en su cliente y va directo al lead — no tiene
 * que copiar/pegar la dirección desde el cuerpo del mensaje.
 *
 * Persistencia: usamos el modelo `EmailNotification` con `EmailType.GENERIC`
 * para no obligar a migración Prisma. El record sirve de auditoría y, si el
 * envío falla, el retry job existente lo levanta más adelante. `userId`
 * queda null porque el lead todavía no es User.
 */

export async function sendContactInquiryEmail(args: {
  name: string
  email: string
  phone?: string | undefined
  topic: InquiryTopic
  message: string
}): Promise<{ ok: boolean }> {
  const inbox = env.EMAIL_REPLY_TO
  if (!inbox) {
    // Sin buzón destino no hay a quién avisar. Logueamos para que el
    // operador detecte la mala configuración rápido.
    console.error(
      "[contact] EMAIL_REPLY_TO no configurado — no hay buzón destino",
    )
    return { ok: false }
  }

  const topicLabel = InquiryTopicLabel[args.topic]
  const subject = `Consulta · ${topicLabel} · ${args.name}`

  const messageHtml = escapeHtmlInline(args.message).replace(/\n/g, "<br>")
  const detailsBlock =
    `<strong>Nombre:</strong> ${escapeHtmlInline(args.name)}<br>` +
    `<strong>Correo:</strong> ${escapeHtmlInline(args.email)}<br>` +
    (args.phone
      ? `<strong>Teléfono:</strong> ${escapeHtmlInline(args.phone)}<br>`
      : "") +
    `<strong>Tipo de consulta:</strong> ${escapeHtmlInline(topicLabel)}`

  const html = renderEmail({
    preheader: `${args.name} dejó una consulta sobre ${topicLabel.toLowerCase()}.`,
    eyebrow: "Consulta del landing",
    heading: `Nueva consulta · ${topicLabel}`,
    body: [
      detailsBlock,
      `<strong style="display:block;margin-bottom:8px;">Mensaje</strong>${messageHtml}`,
    ],
    fineprint:
      "Para responder, usa el botón de Reply de tu cliente — el correo del visitante va en el header Reply-To.",
  })

  const notif = await prisma.emailNotification.create({
    data: {
      to: inbox,
      subject,
      type: EmailType.GENERIC,
      templateData: {
        kind: "CONTACT_INQUIRY",
        from: env.EMAIL_FROM,
        replyTo: args.email,
        inquiryName: args.name,
        inquiryEmail: args.email,
        inquiryTopic: args.topic,
        html,
      },
      status: EmailStatus.QUEUED,
    },
  })

  try {
    await emailProvider().send({
      to: inbox,
      subject,
      html,
      from: env.EMAIL_FROM,
      replyTo: args.email,
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

function escapeHtmlInline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
