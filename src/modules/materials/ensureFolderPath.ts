import "server-only"
import { prisma } from "@/lib/prisma"
import { NameSchema } from "./schemas"
import { ensureLevelRoot, findFolderByNameInParent, resolveProgramLevel } from "./queries"

/**
 * Asegura (crea si falta) la cadena de carpetas `segments` bajo la raíz del
 * `ProgramLevel` identificado por `programName` + `levelCode`, y devuelve el
 * `folderId` de la hoja. Idempotente: reutiliza carpetas existentes por nombre.
 *
 * Es la operación que consume el endpoint de ingesta masiva (`ensure-folder`)
 * para recrear el árbol del drive (INSTALL/, PDF/, subcarpetas) antes de subir
 * archivos. Reutiliza `ensureLevelRoot` (raíz por nivel), `findFolderByNameInParent`
 * (idempotencia) y `NameSchema` (validación) — misma semántica que
 * `createFolder.action.ts`, pero sin el ida y vuelta de un Server Action.
 */

export type EnsureFolderPathResult = { ok: true; folderId: string } | { ok: false; error: string }

export async function ensureFolderPath(
  input: { programName: string; levelCode: string; segments: string[] },
  userId: string,
): Promise<EnsureFolderPathResult> {
  const level = await resolveProgramLevel(input.programName, input.levelCode)
  if (!level) {
    return {
      ok: false,
      error: `Nivel no encontrado: programa "${input.programName}", nivel "${input.levelCode}"`,
    }
  }

  // Raíz del nivel (autocreada on-demand, atribuida a este usuario).
  const root = await ensureLevelRoot(level.id, `${input.programName} ${input.levelCode}`, userId)

  let parentId = root.id
  for (const rawSegment of input.segments) {
    const parsed = NameSchema.safeParse(rawSegment)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Nombre de carpeta inválido" }
    }
    const name = parsed.data

    const existing = await findFolderByNameInParent(parentId, name)
    if (existing) {
      parentId = existing.id
      continue
    }

    const created = await prisma.materialFolder.create({
      data: { parentId, name, programLevelId: level.id, createdById: userId },
      select: { id: true },
    })
    parentId = created.id
  }

  return { ok: true, folderId: parentId }
}
