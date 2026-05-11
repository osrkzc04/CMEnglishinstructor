"use server"

import { headers } from "next/headers"
import { verifyTurnstile } from "@/lib/security/turnstile"
import { checkLimit } from "@/lib/security/rateLimit"
import { sendContactInquiryEmail } from "./emails"
import { PublicInquirySchema, type PublicInquiryInput } from "./publicSchemas"

/**
 * Action invocada desde el form de contacto del landing. NO requiere
 * sesión — la abre cualquier visitante. El control de abuso combina:
 *
 *  - Rate-limit por IP (1 envío cada 5 minutos)
 *  - Verificación Cloudflare Turnstile (server-side)
 *  - Rate-limit por email (3 envíos por hora — más permisivo que la
 *    postulación porque alguien legítimo puede mandar varias consultas
 *    sobre temas distintos)
 *
 * El email de notificación se envía sincrónicamente porque el resultado
 * del envío informa el feedback al usuario (success/error). Si el SMTP
 * falla, el record en `EmailNotification` queda en FAILED y el retry job
 * lo levanta — pero el usuario ve "no pudimos enviar, intenta de nuevo".
 *
 * NO persistimos un modelo `ContactInquiry` separado: el record en
 * `EmailNotification` (con type=GENERIC y kind=CONTACT_INQUIRY en
 * templateData) sirve de auditoría sin requerir migración Prisma.
 */

type Result =
  | { success: true }
  | {
      success: false
      error: string
      field?: keyof PublicInquiryInput
    }

const IP_WINDOW_MS = 5 * 60 * 1000
const IP_LIMIT = 1
const EMAIL_WINDOW_MS = 60 * 60 * 1000
const EMAIL_LIMIT = 3

export async function createPublicInquiry(input: PublicInquiryInput): Promise<Result> {
  const parsed = PublicInquirySchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof PublicInquiryInput | undefined
    return {
      success: false,
      error: issue?.message ?? "Datos inválidos",
      field,
    }
  }
  const data = parsed.data

  const ip = await getClientIp()

  const ipCheck = checkLimit({
    key: `inquiry:ip:${ip ?? "unknown"}`,
    limit: IP_LIMIT,
    windowMs: IP_WINDOW_MS,
  })
  if (!ipCheck.ok) {
    return {
      success: false,
      error: `Demasiados intentos. Intenta de nuevo en ${ipCheck.retryAfterSec} segundos.`,
    }
  }

  const captcha = await verifyTurnstile(data.turnstileToken, ip ?? undefined)
  if (!captcha.ok) {
    return {
      success: false,
      error: "No pudimos validar la verificación anti-spam. Recarga la página e intenta de nuevo.",
      field: "turnstileToken",
    }
  }

  const emailCheck = checkLimit({
    key: `inquiry:email:${data.email}`,
    limit: EMAIL_LIMIT,
    windowMs: EMAIL_WINDOW_MS,
  })
  if (!emailCheck.ok) {
    return {
      success: false,
      error:
        "Recibimos varias consultas con este correo recientemente. Espera un momento e intenta de nuevo.",
      field: "email",
    }
  }

  const sent = await sendContactInquiryEmail({
    name: data.name,
    email: data.email,
    phone: data.phone,
    topic: data.topic,
    message: data.message,
  })
  if (!sent.ok) {
    return {
      success: false,
      error:
        "No pudimos enviar tu consulta en este momento. Intenta de nuevo en unos minutos o escríbenos a hola@cmenglishinstructor.com.",
    }
  }

  return { success: true }
}

async function getClientIp(): Promise<string | null> {
  const h = await headers()
  // El primer hop confiable detrás de un proxy: x-forwarded-for tiene
  // todas las IPs separadas por coma, la del cliente va primero.
  const xff = h.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  return h.get("x-real-ip")
}
