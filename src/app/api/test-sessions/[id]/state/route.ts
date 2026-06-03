import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { checkDeviceAccess, DEVICE_COOKIE } from "@/modules/tests/sessions/device-lock"
import { getSessionStateById } from "@/modules/tests/sessions/queries"
import { finalizeAsTimedOut } from "@/modules/tests/sessions/finalize-as-timed-out"
import { clientHints, errorToResponse } from "../../_helpers"
import { DeviceMismatchError } from "@/modules/tests/sessions/errors"

/**
 * GET /api/test-sessions/[id]/state
 *
 * Devuelve el estado público de la sesión: tiempo restante, preguntas
 * visibles (sección actual), progreso de tarjetas. Si el deadline ya venció,
 * marca TIMED_OUT antes de responder (lazy expire).
 *
 * El cliente lo usa para resincronizar el reloj y refrescar respuestas
 * tras un reload.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const GRACE_MS = 30_000

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userAgent, ip } = clientHints(req)
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(DEVICE_COOKIE.name)?.value ?? null

  try {
    const session = await prisma.testSession.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        deadline: true,
        deviceCookieHash: true,
        deviceFingerprint: true,
      },
    })
    if (!session) {
      return NextResponse.json({ error: "session_not_found" }, { status: 404 })
    }

    const access = checkDeviceAccess({
      cookieHashOnSession: session.deviceCookieHash,
      fingerprintOnSession: session.deviceFingerprint,
      cookieValueFromRequest: cookieValue,
      userAgentFromRequest: userAgent,
      ipFromRequest: ip,
    })
    if (!access.ok) {
      throw new DeviceMismatchError(access.reason)
    }

    // Lazy expire — para IN_PROGRESS y PENDING_WRITING (ambos comparten el
    // deadline global del examen). El finalize-as-timed-out es idempotente.
    if (session.status === "IN_PROGRESS" || session.status === "PENDING_WRITING") {
      const now = Date.now()
      if (now > session.deadline.getTime() + GRACE_MS) {
        await prisma.$transaction(async (tx) => {
          await finalizeAsTimedOut(tx, session.id)
        })
      }
    }

    const state = await getSessionStateById(id)
    if (!state) {
      return NextResponse.json({ error: "session_not_found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true, state })
  } catch (err) {
    return errorToResponse(err)
  }
}
