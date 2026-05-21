import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { submitPlacementSession } from "@/modules/tests/sessions/submit"
import { DEVICE_COOKIE } from "@/modules/tests/sessions/device-lock"
import { clientHints, errorToResponse } from "../../_helpers"

/**
 * POST /api/test-sessions/[id]/submit
 *
 * Cierre explícito de la sesión. En el flujo adaptativo el cierre normal
 * pasa por `advance-section`; este endpoint queda para forzar el cierre por
 * cron o futuros casos UI (abandonar).
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userAgent, ip } = clientHints(req)
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(DEVICE_COOKIE.name)?.value ?? null

  try {
    const result = await submitPlacementSession(id, { userAgent, ip, cookieValue })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return errorToResponse(err)
  }
}
