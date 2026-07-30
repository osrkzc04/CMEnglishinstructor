import { NextResponse } from "next/server"
import { requireRole, ForbiddenError, UnauthorizedError } from "@/modules/auth/guards"
import { listProgramsWithLevels } from "@/modules/materials/queries"

/**
 * Devuelve los programas con sus niveles (code + name) para que la ingesta
 * masiva remota (`scripts/import-materials-remote.ts`) resuelva del lado del
 * cliente el nombre de carpeta de disco → `ProgramLevel.code`.
 *
 *   GET /api/materials/levels
 *   → [{ "programName": "Life", "levels": [{ "code": "1", "name": "Life 1" }, …] }]
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireRole(["DIRECTOR", "COORDINATOR"])
    return NextResponse.json(await listProgramsWithLevels())
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    console.error("[materials/levels] error:", err)
    return NextResponse.json({ error: "Falla al listar niveles" }, { status: 500 })
  }
}
