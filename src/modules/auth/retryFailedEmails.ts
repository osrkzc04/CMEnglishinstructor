import "server-only"
import { EmailStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { emailProvider } from "@/lib/email"

/**
 * Reintenta los `EmailNotification` que quedaron en `FAILED` con menos de
 * `MAX_ATTEMPTS` intentos. Pensado para correrse periódicamente (cron) ante
 * fallos transitorios del proveedor (timeouts, 5xx, rate limits).
 *
 * El HTML se persiste en `templateData.html` al primer intento, así que el
 * reintento no necesita reconstruir nada — solo despachar lo guardado. Los
 * registros sin HTML (formatos viejos previos a esta política) se marcan
 * como `CANCELLED` para que no queden en la cola para siempre.
 */

const MAX_ATTEMPTS = 3
const BATCH_SIZE = 50

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
  const candidates = await prisma.emailNotification.findMany({
    where: {
      status: EmailStatus.FAILED,
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
      await prisma.emailNotification.update({
        where: { id: notif.id },
        data: {
          attempts: { increment: 1 },
          error: err instanceof Error ? err.message : String(err),
          // status sigue en FAILED; si alcanza MAX_ATTEMPTS, deja de
          // levantarse en la próxima corrida porque el `where` filtra.
        },
      })
      result.failed++
    }
  }

  return result
}

/**
 * Cuenta cuántos emails están pendientes de retry. Útil para el dashboard
 * admin si más adelante se quiere mostrar el estado de la cola.
 */
export async function countPendingRetries(): Promise<number> {
  return prisma.emailNotification.count({
    where: {
      status: EmailStatus.FAILED,
      attempts: { lt: MAX_ATTEMPTS },
    },
  })
}

// Re-exporta el tipo de Prisma para que los consumidores no necesiten
// importarlo aparte.
export type { Prisma }
