import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { cleanupStaleUploads } from "@/modules/materials/cleanupStaleUploads"

/**
 * GET /api/cron/cleanup-uploads
 *
 * Endpoint HTTP para disparar la limpieza de subidas por chunks abandonadas
 * (PENDING > 24h). La lógica vive en `cleanupStaleUploads`; también la corre el
 * scheduler in-process (`src/lib/jobs/scheduler.ts`). Este endpoint sirve para
 * dispararla a demanda o desde un cron externo.
 *
 * Autenticación: Bearer token contra `CRON_SECRET`.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 500 })
  }
  const auth = req.headers.get("authorization") ?? ""
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (provided !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await cleanupStaleUploads()
  return NextResponse.json({ ok: true, ...result })
}
