import { NextResponse } from "next/server"
import { requireRole, ForbiddenError, UnauthorizedError } from "@/modules/auth/guards"
import { CreateUploadSessionSchema } from "@/modules/materials/schemas"
import { createSession } from "@/modules/materials/resumableUpload"

/**
 * Crea una sesión de subida por chunks (reanudable) para archivos pesados.
 *
 *   POST /api/materials/upload/session
 *   { folderId, name, size, mimeType }  ->  { uploadId, offset, chunkSize }
 *
 * Luego el cliente sube el archivo en chunks vía PATCH a
 * /api/materials/upload/session/[uploadId] y finaliza con .../complete.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const user = await requireRole(["DIRECTOR", "COORDINATOR"])

    const body = await req.json().catch(() => null)
    const parsed = CreateUploadSessionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 },
      )
    }

    const result = await createSession({ ...parsed.data, userId: user.id })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    return NextResponse.json({
      uploadId: result.uploadId,
      offset: result.offset,
      chunkSize: result.chunkSize,
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    console.error("[materials/upload/session] error:", err)
    return NextResponse.json({ error: "Falla al crear la sesión de subida" }, { status: 500 })
  }
}
