import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { prisma } from "@/lib/prisma"
import { finalizeAsTimedOut } from "@/modules/tests/sessions/finalize-as-timed-out"

/**
 * GET /api/cron/expire-test-sessions
 *
 * Recoge sesiones IN_PROGRESS o PENDING_WRITING cuyo deadline venció hace
 * más de 5 min (margen para no chocar con la lazy expire) y las marca
 * TIMED_OUT con auto-grade. Si la sesión estaba en PENDING_WRITING, el
 * writingResponse parcial que hubiera quedado guardado se preserva.
 *
 * Autenticación: Bearer token contra `CRON_SECRET`.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const STALE_MARGIN_MS = 5 * 60_000

export async function GET(req: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 500 })
  }
  const auth = req.headers.get("authorization") ?? ""
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (provided !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - STALE_MARGIN_MS)
  const stale = await prisma.testSession.findMany({
    where: {
      status: { in: ["IN_PROGRESS", "PENDING_WRITING"] },
      deadline: { lt: cutoff },
    },
    select: { id: true },
  })

  let finalized = 0
  for (const s of stale) {
    try {
      const result = await prisma.$transaction(async (tx) => finalizeAsTimedOut(tx, s.id))
      if (result && !result.wasIdempotent) finalized++
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[cron expire-test-sessions] failed", s.id, err)
    }
  }

  return NextResponse.json({ ok: true, scanned: stale.length, finalized })
}
