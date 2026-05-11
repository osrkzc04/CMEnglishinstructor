"use server"

import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { verifyTurnstile } from "@/lib/security/turnstile"
import { checkLimit } from "@/lib/security/rateLimit"
import { sendApplicationReceivedEmail } from "./emails"
import { PublicApplicationSchema, type PublicApplicationInput } from "./publicSchemas"

/**
 * Action invocada desde el form público `/postular-docente`. NO usa
 * `requireRole` porque la abre cualquier visitante. El control de abuso
 * combina:
 *
 *  - Cloudflare Turnstile (server-side verify)
 *  - Rate-limit por IP (1 envío cada 5 min)
 *  - Rate-limit por email (1 envío cada 24 h)
 *  - Bloqueo de duplicados — si el email ya está como User o como
 *    postulación PENDING, devolvemos error claro con campo, igual que el
 *    canal admin.
 *
 * El email de acuse se dispara después del commit (nunca dentro de una
 * transacción Prisma) y un fallo del SMTP no rompe la respuesta — el
 * registro queda creado y el retry job lo levanta.
 */

type Result =
  | { success: true; applicationId: string }
  | {
      success: false
      error: string
      field?: keyof PublicApplicationInput
    }

const IP_WINDOW_MS = 5 * 60 * 1000
const IP_LIMIT = 1
const EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000
const EMAIL_LIMIT = 1

export async function createPublicApplication(input: PublicApplicationInput): Promise<Result> {
  const parsed = PublicApplicationSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof PublicApplicationInput | undefined
    return {
      success: false,
      error: issue?.message ?? "Datos inválidos",
      field,
    }
  }
  const data = parsed.data

  const ip = await getClientIp()

  const ipCheck = checkLimit({
    key: `application:ip:${ip ?? "unknown"}`,
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
    key: `application:email:${data.email}`,
    limit: EMAIL_LIMIT,
    windowMs: EMAIL_WINDOW_MS,
  })
  if (!emailCheck.ok) {
    return {
      success: false,
      error: "Ya recibimos una postulación con este correo recientemente.",
      field: "email",
    }
  }

  const conflict = await findEmailConflict(data.email)
  if (conflict) return { success: false, error: conflict, field: "email" }

  const created = await prisma.$transaction(async (tx) => {
    const app = await tx.teacherApplication.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        document: data.document,
        bio: data.bio,
        consentAcceptedAt: new Date(),
      },
    })
    await tx.teacherApplicationLevel.createMany({
      data: data.levelIds.map((levelId) => ({
        applicationId: app.id,
        levelId,
      })),
    })
    await tx.applicationAvailability.createMany({
      data: data.availability.map((s) => ({
        applicationId: app.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    })
    return app
  })

  // Fuera de transacción — un error del SMTP no debe abortar la creación.
  void sendApplicationReceivedEmail({
    applicationId: created.id,
    email: created.email,
    firstName: created.firstName,
  }).catch(() => {
    /* el retry job lo levanta */
  })

  return { success: true, applicationId: created.id }
}

async function findEmailConflict(email: string): Promise<string | null> {
  const [user, pending] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.teacherApplication.findFirst({
      where: { email, status: "PENDING" },
    }),
  ])
  if (user) return "Ya existe una cuenta con este correo"
  if (pending) return "Ya tenemos una postulación pendiente con este correo"
  return null
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
