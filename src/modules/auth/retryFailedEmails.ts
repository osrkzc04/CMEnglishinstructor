import "server-only"
import { EmailStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { emailProvider } from "@/lib/email"

/**
 * Despacha todos los `EmailNotification` pendientes:
 *
 *   - `QUEUED`  → primer intento de envío (los crea `deliverEmail` y nunca
 *                 los intenta sincronamente para no bloquear server actions).
 *   - `FAILED`  → reintento si todavía está bajo `MAX_ATTEMPTS`, ante fallos
 *                 transitorios del proveedor (timeouts, 5xx, rate limits).
 *
 * El HTML se persiste en `templateData.html` al crear la fila, así que el
 * envío real no reconstruye nada — solo despacha lo guardado. Los registros
 * sin HTML (formato viejo) se marcan como `CANCELLED` para que no queden en
 * la cola para siempre.
 *
 * Concurrencia: un guard de proceso (`isProcessing`) evita que dos
 * disparadores simultáneos del mismo Node procesen la cola en paralelo y
 * envíen el mismo email dos veces.
 */

const MAX_ATTEMPTS = 3
const BATCH_SIZE = 50

let isProcessing = false

type StoredTemplate = {
  kind?: string
  html?: string
  from?: string
  replyTo?: string | null
}

export type RetryResult = {
  attempted: number
  succeeded: number
  failed: number
  cancelled: number
}

export async function retryFailedEmails(): Promise<RetryResult> {
  if (isProcessing) {
    return { attempted: 0, succeeded: 0, failed: 0, cancelled: 0 }
  }
  isProcessing = true
  try {
    return await runOnce()
  } finally {
    isProcessing = false
  }
}

async function runOnce(): Promise<RetryResult> {
  const candidates = await prisma.emailNotification.findMany({
    where: {
      status: { in: [EmailStatus.QUEUED, EmailStatus.FAILED] },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  })

  const result: RetryResult = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
  }

  for (const notif of candidates) {
    const tpl = (notif.templateData ?? {}) as StoredTemplate
    if (!tpl.html) {
      await prisma.emailNotification.update({
        where: { id: notif.id },
        data: {
          status: EmailStatus.CANCELLED,
          error: "templateData.html ausente — no se puede reintentar",
        },
      })
      result.cancelled++
      continue
    }

    result.attempted++
    try {
      await emailProvider().send({
        to: notif.to,
        cc: notif.cc ?? undefined,
        subject: notif.subject,
        html: tpl.html,
        from: tpl.from,
        replyTo: tpl.replyTo ?? undefined,
      })
      await prisma.emailNotification.update({
        where: { id: notif.id },
        data: {
          status: EmailStatus.SENT,
          sentAt: new Date(),
          attempts: { increment: 1 },
          error: null,
        },
      })
      result.succeeded++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // eslint-disable-next-line no-console
      console.error(
        `[email-queue] FAIL id=${notif.id} to=${notif.to} subject="${notif.subject}" attempts=${notif.attempts + 1} err=${message}`,
      )
      await prisma.emailNotification.update({
        where: { id: notif.id },
        data: {
          status: EmailStatus.FAILED,
          attempts: { increment: 1 },
          error: message,
        },
      })
      result.failed++
    }
  }

  return result
}

/**
 * Despacha UN solo `EmailNotification` por id — variante de `retryFailedEmails`
 * pensada para el flush "fire-and-forget" inmediato post-creación.
 *
 * Por qué existe: `deliverEmail` solía disparar `retryFailedEmails()` completo
 * en cada send, lo que tenía el efecto colateral de re-enviar correos viejos
 * con status FAILED para destinatarios distintos. Ese flush global queda como
 * red de seguridad del cron periódico — el `setImmediate` post-creación ya
 * solo se ocupa del email recién encolado.
 *
 * Si la fila ya no está QUEUED (caso raro: el cron la atrapó en milisegundos),
 * salta sin tocar. Errores actualizan a FAILED para que el cron reintente.
 */
export async function sendNotificationById(notificationId: string): Promise<void> {
  const notif = await prisma.emailNotification.findUnique({
    where: { id: notificationId },
  })
  if (!notif) return
  if (notif.status !== EmailStatus.QUEUED && notif.status !== EmailStatus.FAILED) {
    return
  }
  if (notif.attempts >= MAX_ATTEMPTS) return

  const tpl = (notif.templateData ?? {}) as StoredTemplate
  if (!tpl.html) {
    await prisma.emailNotification.update({
      where: { id: notif.id },
      data: {
        status: EmailStatus.CANCELLED,
        error: "templateData.html ausente — no se puede reintentar",
      },
    })
    return
  }

  try {
    await emailProvider().send({
      to: notif.to,
      cc: notif.cc ?? undefined,
      subject: notif.subject,
      html: tpl.html,
      from: tpl.from,
      replyTo: tpl.replyTo ?? undefined,
    })
    await prisma.emailNotification.update({
      where: { id: notif.id },
      data: {
        status: EmailStatus.SENT,
        sentAt: new Date(),
        attempts: { increment: 1 },
        error: null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // eslint-disable-next-line no-console
    console.error(
      `[email-queue] FAIL id=${notif.id} to=${notif.to} subject="${notif.subject}" attempts=${notif.attempts + 1} err=${message}`,
    )
    await prisma.emailNotification.update({
      where: { id: notif.id },
      data: {
        status: EmailStatus.FAILED,
        attempts: { increment: 1 },
        error: message,
      },
    })
  }
}

/**
 * Cuenta cuántos emails están pendientes (encolados o con retry posible).
 * Útil para el dashboard admin si más adelante se quiere mostrar el estado
 * de la cola.
 */
export async function countPendingRetries(): Promise<number> {
  return prisma.emailNotification.count({
    where: {
      status: { in: [EmailStatus.QUEUED, EmailStatus.FAILED] },
      attempts: { lt: MAX_ATTEMPTS },
    },
  })
}

// Re-exporta el tipo de Prisma para que los consumidores no necesiten
// importarlo aparte.
export type { Prisma }
