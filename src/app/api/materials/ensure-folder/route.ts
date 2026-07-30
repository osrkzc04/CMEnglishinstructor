import { NextResponse } from "next/server"
import { z } from "zod"
import { requireRole, ForbiddenError, UnauthorizedError } from "@/modules/auth/guards"
import { ensureFolderPath } from "@/modules/materials/ensureFolderPath"

/**
 * Asegura el árbol de carpetas de un nivel y devuelve el `folderId` de la hoja.
 *
 * Usado por la ingesta masiva de materiales (cliente externo que apunta a la
 * URL de producción — ver `scripts/import-materials-remote.ts`). Se expone como
 * route handler (no Server Action) porque el consumidor es un proceso externo.
 *
 *   POST /api/materials/ensure-folder
 *   { "programName": "Life", "levelCode": "1", "segments": ["INSTALL", "LIFE 1 PC"] }
 *   → { "folderId": "cuid" }
 *
 * `segments` vacío devuelve la raíz del nivel. Idempotente: reutiliza carpetas
 * existentes por nombre.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BodySchema = z.object({
  programName: z.string().min(1),
  levelCode: z.string().min(1),
  segments: z.array(z.string()).default([]),
})

export async function POST(req: Request) {
  try {
    const user = await requireRole(["DIRECTOR", "COORDINATOR"])

    const json = await req.json().catch(() => null)
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Cuerpo inválido" },
        { status: 400 },
      )
    }

    const result = await ensureFolderPath(parsed.data, user.id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ folderId: result.folderId })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    console.error("[materials/ensure-folder] error:", err)
    return NextResponse.json({ error: "Falla al asegurar la carpeta" }, { status: 500 })
  }
}
