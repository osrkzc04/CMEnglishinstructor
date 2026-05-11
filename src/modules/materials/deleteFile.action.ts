"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { storage } from "@/lib/storage"
import { DeleteFileSchema, type DeleteFileInput } from "./schemas"

type Result = { success: true } | { success: false; error: string }

export async function deleteFile(input: DeleteFileInput): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = DeleteFileSchema.safeParse(input)
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }

  const file = await prisma.materialFile.findUnique({
    where: { id: parsed.data.fileId },
    select: { id: true, folderId: true, storageKey: true, deletedAt: true },
  })
  if (!file || file.deletedAt) return { success: false, error: "Archivo no encontrado" }

  await prisma.materialFile.delete({ where: { id: file.id } })
  await storage()
    .delete(file.storageKey)
    .catch(() => {})

  revalidatePath(`/admin/materiales/${file.folderId}`)
  return { success: true }
}
