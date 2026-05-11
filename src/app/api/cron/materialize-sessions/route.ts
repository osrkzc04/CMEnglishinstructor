import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { materializeUpcomingForAllActive } from "@/modules/classGroups/materializeUpcoming"

/**
 * Endpoint que materializa las próximas 4 semanas de sesiones para todas
 * las aulas activas con docente vigente.
 *
 * El job equivalente corre **in-process** vía `instrumentation.ts` cada 7
 * días. Este endpoint queda como respaldo para:
 *   - cron del hosting (cPanel / Plesk crontab),
 *   - Vercel Cron (configurado en `vercel.json`),
 *   - invocaciones manuales después de una migración o restore.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://<host>/api/cron/materialize-sessions
 *
 * Autenticación: Bearer token contra `CRON_SECRET`.
 */

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 500 })
  }

  const auth = req.headers.get("authorization") ?? ""
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (provided !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await materializeUpcomingForAllActive()
    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    )
  }
}
