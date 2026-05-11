"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { RenameFileSchema, type RenameFileInput } from "./schemas"
import { findFileByNameInFolder } from "./queries"

type Result =
  | { success: true }
  | { success: false; error: string; field?: keyof RenameFileInput }

export async function renameFile(input: RenameFileInput): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = RenameFileSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof RenameFileInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const file = await prisma.materialFile.findUnique({
    where: { id: data.fileId },
    select: { id: true, folderId: true, deletedAt: true },
  })
  if (!file || file.deletedAt) return { success: false, error: "Archivo no encontrado", field: "fileId" }

  const conflict = await findFileByNameInFolder(file.folderId, data.name, file.id)
  if (conflict) return { success: false, error: "Ya existe un archivo con ese nombre", field: "name" }

  await prisma.materialFile.update({ where: { id: file.id }, data: { name: data.name } })

  revalidatePath(`/admin/materiales/${file.folderId}`)
  return { success: true }
}
