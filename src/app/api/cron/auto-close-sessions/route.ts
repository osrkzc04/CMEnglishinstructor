import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { autoCloseStaleSessions } from "@/modules/classes/autoCloseStaleSessions"

/**
 * Endpoint que cierra automáticamente las sesiones SCHEDULED que pasaron
 * 5 min de su `scheduledEnd` sin bitácora ni asistencia tomada.
 *
 * El job equivalente corre **in-process** cada 5 min vía `instrumentation.ts`.
 * Este endpoint queda como respaldo para:
 *   - cron del hosting (cPanel / Plesk / Vercel Cron),
 *   - invocaciones manuales después de una caída larga del server.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://<host>/api/cron/auto-close-sessions
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
    const summary = await autoCloseStaleSessions()
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
