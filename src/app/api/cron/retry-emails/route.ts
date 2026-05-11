import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { retryFailedEmails } from "@/modules/auth/retryFailedEmails"

/**
 * Endpoint que reintenta envíos de email en estado FAILED.
 *
 * El reintento normal corre **in-process** vía `instrumentation.ts` cada 15
 * min. Este endpoint queda como respaldo para invocaciones manuales o
 * cuando el hosting expone su propio cron (cPanel, system crontab) y se
 * prefiere disparar desde ahí — útil si la app reinicia con frecuencia y
 * el intervalo in-process se pierde a menudo.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://<host>/api/cron/retry-emails
 *
 * Autenticación: Bearer token contra `CRON_SECRET`.
 */

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET no configurado" },
      { status: 500 },
    )
  }

  const auth = req.headers.get("authorization") ?? ""
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (provided !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await retryFailedEmails()
    return NextResponse.json({ ok: true, ...result })
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
