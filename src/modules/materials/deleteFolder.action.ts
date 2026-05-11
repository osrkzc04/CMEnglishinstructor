"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { storage } from "@/lib/storage"
import { DeleteFolderSchema, type DeleteFolderInput } from "./schemas"

type Result =
  | { success: true; folderCount: number; fileCount: number }
  | { success: false; error: string }

/**
 * Borra una carpeta con todo lo que contiene (subcarpetas + archivos).
 *
 * Estrategia: hard-delete. Materiales no son entidades con historia
 * (no quedan auditorías ligadas), y dejarlos en soft-delete sin un job
 * de limpieza llenaría disco eternamente. El admin confirma en UI con
 * conteos antes de invocar esto.
 *
 * Walk recursivo del árbol → reúne todas las storageKeys → transacción
 * de DB que cascadea por la FK → cleanup en disco después del commit.
 */
export async function deleteFolder(input: DeleteFolderInput): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = DeleteFolderSchema.safeParse(input)
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }

  const folder = await prisma.materialFolder.findUnique({
    where: { id: parsed.data.folderId },
    select: { id: true, parentId: true, deletedAt: true },
  })
  if (!folder || folder.deletedAt) return { success: false, error: "Carpeta no encontrada" }
  if (folder.parentId === null) {
    return { success: false, error: "La raíz del nivel no se puede eliminar" }
  }

  const collected = await collectDescendants(folder.id)

  // DB primero — si la transacción falla, los archivos siguen en disco
  // y el repositorio queda consistente. El reverso (storage primero) deja
  // basura sin referencia si la DB falla.
  await prisma.$transaction(async (tx) => {
    // Borrar archivos primero (cascada de la FK los traería pero somos
    // explícitos para evitar Restrict del root del subtree).
    if (collected.files.length > 0) {
      await tx.materialFile.deleteMany({
        where: { id: { in: collected.files.map((f) => f.id) } },
      })
    }
    // Borrar subcarpetas en orden inverso (hojas primero) para esquivar
    // el `onDelete: Restrict` del self-ref.
    for (const subId of [...collected.folderIds].reverse()) {
      await tx.materialFolder.delete({ where: { id: subId } })
    }
    await tx.materialFolder.delete({ where: { id: folder.id } })
  })

  // Cleanup del disco — best-effort; si falla, registramos huérfanos pero
  // la operación lógica ya está commit-eada.
  const adapter = storage()
  await Promise.allSettled(collected.files.map((f) => adapter.delete(f.storageKey)))

  if (folder.parentId) revalidatePath(`/admin/materiales/${folder.parentId}`)
  return {
    success: true,
    folderCount: collected.folderIds.length + 1,
    fileCount: collected.files.length,
  }
}

async function collectDescendants(rootId: string): Promise<{
  folderIds: string[]
  files: { id: string; storageKey: string }[]
}> {
  const folderIds: string[] = []
  const files: { id: string; storageKey: string }[] = []
  const queue: string[] = [rootId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    const children = await prisma.materialFolder.findMany({
      where: { parentId: currentId },
      select: { id: true },
    })
    for (const c of children) {
      folderIds.push(c.id)
      queue.push(c.id)
    }
    const folderFiles = await prisma.materialFile.findMany({
      where: { folderId: currentId },
      select: { id: true, storageKey: true },
    })
    files.push(...folderFiles)
  }
  return { folderIds, files }
}
