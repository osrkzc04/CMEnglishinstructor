import { NextResponse } from "next/server"
import { requireRole, ForbiddenError, UnauthorizedError } from "@/modules/auth/guards"
import { completeSession } from "@/modules/materials/resumableUpload"

/**
 * Finaliza una sesión de subida por chunks: valida que llegó completa, promueve
 * el blob temporal al key final y crea el `MaterialFile`.
 *
 *   POST /api/materials/upload/session/[uploadId]/complete  ->  { id, name, ... }
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_req: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  try {
    const user = await requireRole(["DIRECTOR", "COORDINATOR"])
    const { uploadId } = await params

    const result = await completeSession(uploadId, user.id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    return NextResponse.json(result.file)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    console.error("[materials/upload/session/complete] error:", err)
    return NextResponse.json({ error: "Falla al finalizar la subida" }, { status: 500 })
  }
}
