import { NextResponse } from "next/server"
import { requireRole, ForbiddenError, UnauthorizedError } from "@/modules/auth/guards"
import { getSession, appendChunk, abortSession } from "@/modules/materials/resumableUpload"

/**
 * Operaciones sobre una sesión de subida por chunks.
 *
 *   GET    .../session/[uploadId]           -> { offset, total, status }  (reanudar)
 *   PATCH  .../session/[uploadId]           -> anexa un chunk (header Upload-Offset)
 *   DELETE .../session/[uploadId]           -> aborta y limpia
 *
 * El body del PATCH es binario crudo (el chunk); el offset esperado va en el
 * header `Upload-Offset`. Si el offset no coincide con lo persistido, responde
 * 409 con el offset real para que el cliente re-sincronice.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ uploadId: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireRole(["DIRECTOR", "COORDINATOR"])
    const { uploadId } = await params

    const result = await getSession(uploadId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    return NextResponse.json({
      offset: result.offset,
      total: result.total,
      status: result.status,
    })
  } catch (err) {
    return mapError(err, "[materials/upload/session GET]")
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireRole(["DIRECTOR", "COORDINATOR"])
    const { uploadId } = await params

    const rawOffset = req.headers.get("upload-offset")
    const expectedOffset = Number(rawOffset)
    if (rawOffset === null || !Number.isInteger(expectedOffset) || expectedOffset < 0) {
      return NextResponse.json({ error: "Header Upload-Offset inválido" }, { status: 400 })
    }
    if (!req.body) return NextResponse.json({ error: "Chunk vacío" }, { status: 400 })

    const result = await appendChunk(uploadId, expectedOffset, req.body)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, offset: result.offset },
        { status: result.status },
      )
    }

    return NextResponse.json({ offset: result.offset })
  } catch (err) {
    return mapError(err, "[materials/upload/session PATCH]")
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await requireRole(["DIRECTOR", "COORDINATOR"])
    const { uploadId } = await params

    const result = await abortSession(uploadId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return mapError(err, "[materials/upload/session DELETE]")
  }
}

function mapError(err: unknown, tag: string) {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 })
  }
  console.error(`${tag} error:`, err)
  return NextResponse.json({ error: "Falla en la subida" }, { status: 500 })
}
