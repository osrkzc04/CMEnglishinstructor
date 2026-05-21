import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { startPlacementSession } from "@/modules/tests/sessions/start"
import { DEVICE_COOKIE } from "@/modules/tests/sessions/device-lock"
import { clientHints, errorToResponse } from "../_helpers"

/**
 * POST /api/test-sessions/start
 *
 * Body: { token: string }
 *
 * Inicia o retoma una sesión de placement test. Sin autenticación — el token
 * de la URL es la auth. En alta nueva setea la cookie httpOnly del lock de
 * dispositivo. En resume valida que el device sigue siendo el mismo.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BodySchema = z.object({ token: z.string().min(1) })

export async function POST(req: Request) {
  const { userAgent, ip } = clientHints(req)

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

  const cookieStore = await cookies()
  const existing = cookieStore.get(DEVICE_COOKIE.name)?.value ?? null

  try {
    const result = await startPlacementSession({
      token: parsed.data.token,
      userAgent,
      ip,
      existingDeviceCookie: existing,
    })

    const response = NextResponse.json({
      ok: true,
      sessionId: result.sessionId,
      deadline: result.deadline.toISOString(),
      resumed: result.resumed,
    })

    if (result.cookieToSet) {
      // maxAge en segundos hasta el deadline + 30 min de margen.
      const maxAgeSec = Math.max(
        60,
        Math.ceil((result.deadline.getTime() - Date.now()) / 1000) + 1800,
      )
      response.cookies.set({
        name: DEVICE_COOKIE.name,
        value: result.cookieToSet,
        ...DEVICE_COOKIE.options,
        maxAge: maxAgeSec,
      })
    }

    return response
  } catch (err) {
    return errorToResponse(err)
  }
}
