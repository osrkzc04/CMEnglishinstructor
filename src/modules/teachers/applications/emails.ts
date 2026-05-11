import "server-only"
import { EmailType, EmailStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { emailProvider } from "@/lib/email"
import { env } from "@/lib/env"
import { renderEmail } from "@/lib/email/template"

/**
 * Emails relacionados con postulaciones públicas. Hoy solo el acuse de
 * recibo al postulante; cuando se cablee el flujo de aprobación / rechazo
 * se sumarán `TEACHER_APPLICATION_APPROVED` y `TEACHER_APPLICATION_REJECTED`.
 *
 * Persistimos en `EmailNotification` con `userId = null` (el postulante
 * todavía no es User; recién lo será si la coordinación aprueba). El HTML
 * se guarda en `templateData.html` para que el retry job pueda
 * reintentarlo si el SMTP falla.
 */

type DeliverArgs = {
  to: string
  subject: string
  html: string
  type: EmailType
  applicationId: string
}

async function deliverEmail(args: DeliverArgs): Promise<{ ok: boolean }> {
  const notif = await prisma.emailNotification.create({
    data: {
      to: args.to,
      subject: args.subject,
      type: args.type,
      templateData: {
        kind: args.type,
        applicationId: args.applicationId,
        html: args.html,
        from: env.EMAIL_FROM,
        replyTo: env.EMAIL_REPLY_TO ?? null,
      },
      status: EmailStatus.QUEUED,
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
//  Plantilla — acuse de recibo al postulante
// -----------------------------------------------------------------------------

export async function sendApplicationReceivedEmail(args: {
  applicationId: string
  email: string
  firstName: string
}): Promise<{ ok: boolean }> {
  const html = renderEmail({
    preheader:
      "Gracias por postular. Vamos a revisar tu perfil y te contactamos pronto.",
    eyebrow: "Postulación recibida",
    heading: `Hola, ${args.firstName}`,
    body: [
      "Recibimos tu postulación para sumarte como instructor en CM English Instructor. Gracias por tomarte el tiempo de contarnos sobre tu experiencia.",
      "Vamos a revisarla con calma y, si tu perfil coincide con lo que estamos buscando, te escribimos para coordinar una entrevista. El proceso suele tomarnos entre 5 y 10 días hábiles.",
    ],
    fineprint:
      "Este es un correo automático — no es necesario responder. Si necesitas comunicarte con nosotros, escríbenos a coordinacion@cmenglishinstructor.com.",
  })
  return deliverEmail({
    to: args.email,
    subject: "Recibimos tu postulación",
    html,
    type: EmailType.TEACHER_APPLICATION_RECEIVED,
    applicationId: args.applicationId,
  })
}
