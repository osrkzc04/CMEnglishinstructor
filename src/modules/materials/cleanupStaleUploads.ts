import "server-only"
import { prisma } from "@/lib/prisma"
import { storage } from "@/lib/storage"

/**
 * Limpia sesiones de subida por chunks (`MaterialUpload`) que quedaron PENDING
 * y sin actividad por más de 24h — subidas abandonadas (el usuario cerró la
 * pestaña a medias). Borra el blob temporal del storage y la fila.
 *
 * Idempotente y barato. Lo disparan tanto el scheduler in-process como el
 * endpoint `/api/cron/cleanup-uploads`.
 */

const STALE_MS = 24 * 60 * 60_000

export async function cleanupStaleUploads(): Promise<{ scanned: number; cleaned: number }> {
  const cutoff = new Date(Date.now() - STALE_MS)
  const stale = await prisma.materialUpload.findMany({
    where: { status: "PENDING", updatedAt: { lt: cutoff } },
    select: { id: true, tempKey: true },
  })

  let cleaned = 0
  for (const s of stale) {
    try {
      await storage()
        .delete(s.tempKey)
        .catch(() => {})
      await prisma.materialUpload.delete({ where: { id: s.id } })
      cleaned++
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[cleanup-uploads] failed", s.id, err)
    }
  }

  return { scanned: stale.length, cleaned }
}
