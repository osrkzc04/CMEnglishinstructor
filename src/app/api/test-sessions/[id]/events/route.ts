import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { TestEventType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { checkDeviceAccess, DEVICE_COOKIE } from "@/modules/tests/sessions/device-lock"
import { logSessionEvent } from "@/modules/tests/sessions/log-event"
import { clientHints } from "../../_helpers"

/**
 * POST /api/test-sessions/[id]/events
 *
 * Rate-limited a 1 evento por segundo por sesión + tipo, en memoria.
 * Estos eventos NO interrumpen el examen — solo se registran para que la
 * revisión humana los vea (regla 5 del motor).
 *
 * El cliente envía: { type: 'FOCUS_LOST' | ..., metadata?: {} }.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Cliente solo puede reportar este subset — los tipos internos
// (SECTION_ADVANCED, SECTION_LOCKED, DEVICE_MISMATCH, SESSION_RESUMED) los
// inserta el server desde otros endpoints.
const CLIENT_REPORTABLE = new Set<TestEventType>([
  TestEventType.FOCUS_LOST,
  TestEventType.FOCUS_REGAINED,
  TestEventType.FULLSCREEN_EXIT,
  TestEventType.COPY_ATTEMPT,
  TestEventType.PASTE_ATTEMPT,
  TestEventType.QUESTION_VIEWED,
])

const BodySchema = z.object({
  type: z.nativeEnum(TestEventType),
  metadata: z.record(z.unknown()).optional(),
})

const rateLimitWindow = new Map<string, number>()
const RATE_LIMIT_MS = 1000

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userAgent, ip } = clientHints(req)
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(DEVICE_COOKIE.name)?.value ?? null

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  if (!CLIENT_REPORTABLE.has(parsed.data.type)) {
    return NextResponse.json({ error: "type_not_allowed" }, { status: 400 })
  }

  // Rate-limit en memoria — para una sola instancia es suficiente.
  const key = `${id}:${parsed.data.type}`
  const last = rateLimitWindow.get(key) ?? 0
  const now = Date.now()
  if (now - last < RATE_LIMIT_MS) {
    return NextResponse.json({ ok: true, rateLimited: true })
  }
  rateLimitWindow.set(key, now)

  // Device lock — verificar pero no romper el examen si falla.
  const session = await prisma.testSession.findUnique({
    where: { id },
    select: { deviceCookieHash: true, deviceFingerprint: true, status: true },
  })
  if (!session) {
    return NextResponse.json({ ok: true })
  }
  if (session.status !== "IN_PROGRESS") {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const access = checkDeviceAccess({
    cookieHashOnSession: session.deviceCookieHash,
    fingerprintOnSession: session.deviceFingerprint,
    cookieValueFromRequest: cookieValue,
    userAgentFromRequest: userAgent,
    ipFromRequest: ip,
  })
  if (!access.ok) {
    // No bloqueamos por device mismatch en eventos — pero sí lo registramos.
    await logSessionEvent({
      sessionId: id,
      type: TestEventType.DEVICE_MISMATCH,
      metadata: { reason: access.reason },
    })
    return NextResponse.json({ ok: true })
  }

  await logSessionEvent({
    sessionId: id,
    type: parsed.data.type,
    metadata: parsed.data.metadata,
  })
  return NextResponse.json({ ok: true })
}
