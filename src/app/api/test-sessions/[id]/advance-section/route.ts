import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { advanceSection } from "@/modules/tests/sessions/advance-section"
import { DEVICE_COOKIE } from "@/modules/tests/sessions/device-lock"
import { clientHints, errorToResponse } from "../../_helpers"

/**
 * POST /api/test-sessions/[id]/advance-section
 *
 * Commit de la sección actual. Si pasa umbral y hay siguiente, desbloquea.
 * Si no, cierra el examen.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userAgent, ip } = clientHints(req)
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(DEVICE_COOKIE.name)?.value ?? null

  try {
    const result = await advanceSection(id, { userAgent, ip, cookieValue })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return errorToResponse(err)
  }
}
