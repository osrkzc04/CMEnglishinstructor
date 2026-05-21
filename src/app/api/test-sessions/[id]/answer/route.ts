import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { AnswerInputSchema, saveAnswer } from "@/modules/tests/sessions/answer"
import { DEVICE_COOKIE } from "@/modules/tests/sessions/device-lock"
import { clientHints, errorToResponse } from "../../_helpers"

/**
 * POST /api/test-sessions/[id]/answer
 *
 * Auto-save de la respuesta del candidato. Body: { questionOrder, selectedOptionId?,
 * textAnswer?, markedForReview? }.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

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

  const parsed = AnswerInputSchema.safeParse({ ...((body as object) ?? {}), sessionId: id })
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await saveAnswer(parsed.data, { userAgent, ip, cookieValue })
    return NextResponse.json({
      ok: true,
      savedAt: result.savedAt.toISOString(),
      remainingMs: result.remainingMs,
    })
  } catch (err) {
    return errorToResponse(err)
  }
}
