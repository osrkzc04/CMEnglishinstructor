"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { RenameFolderSchema, type RenameFolderInput } from "./schemas"
import { findFolderByNameInParent } from "./queries"

type Result = { success: true } | { success: false; error: string; field?: keyof RenameFolderInput }

export async function renameFolder(input: RenameFolderInput): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = RenameFolderSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof RenameFolderInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const folder = await prisma.materialFolder.findUnique({
    where: { id: data.folderId },
    select: { id: true, parentId: true, deletedAt: true },
  })
  if (!folder || folder.deletedAt) {
    return { success: false, error: "Carpeta no encontrada", field: "folderId" }
  }
  // El root no se renombra desde acá — su nombre lo dicta el `ProgramLevel`.
  if (folder.parentId === null) {
    return { success: false, error: "La raíz del nivel no se renombra", field: "folderId" }
  }

  const conflict = await findFolderByNameInParent(folder.parentId, data.name, folder.id)
  if (conflict) {
    return { success: false, error: "Ya existe una carpeta con ese nombre", field: "name" }
  }

  await prisma.materialFolder.update({
    where: { id: folder.id },
    data: { name: data.name },
  })

  revalidatePath(`/admin/materiales/${folder.parentId}`)
  revalidatePath(`/admin/materiales/${folder.id}`)
  return { success: true }
}
