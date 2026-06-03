import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { submitPlacementWriting } from "@/modules/tests/sessions/submit-writing"
import { DEVICE_COOKIE } from "@/modules/tests/sessions/device-lock"
import { clientHints, errorToResponse } from "../../_helpers"

/**
 * POST /api/test-sessions/[id]/submit-writing
 *
 * Cierre del writing del placement test adaptativo. Solo válido cuando la
 * sesión está en PENDING_WRITING. Body:
 *   { response: string }
 *
 * Respuesta 200: { ok: true, status: "SUBMITTED", writingLevelCode }.
 * Validación de longitud y device lock dentro del módulo.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BodySchema = z.object({
  response: z.string().min(1, "Tu respuesta no puede quedar vacía"),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userAgent, ip } = clientHints(req)
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(DEVICE_COOKIE.name)?.value ?? null

  let parsed: z.infer<typeof BodySchema>
  try {
    parsed = BodySchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "invalid_body", issues: err.issues },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await submitPlacementWriting(id, parsed.response, {
      userAgent,
      ip,
      cookieValue,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return errorToResponse(err)
  }
}
