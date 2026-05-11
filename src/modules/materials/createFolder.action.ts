"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { CreateFolderSchema, type CreateFolderInput } from "./schemas"
import { findFolderByNameInParent } from "./queries"

type Result =
  | { success: true; folderId: string }
  | { success: false; error: string; field?: keyof CreateFolderInput }

export async function createFolder(input: CreateFolderInput): Promise<Result> {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = CreateFolderSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof CreateFolderInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const parent = await prisma.materialFolder.findUnique({
    where: { id: data.parentId },
    select: { id: true, programLevelId: true, deletedAt: true },
  })
  if (!parent || parent.deletedAt) {
    return { success: false, error: "Carpeta padre no encontrada", field: "parentId" }
  }

  const conflict = await findFolderByNameInParent(parent.id, data.name)
  if (conflict) {
    return { success: false, error: "Ya existe una carpeta con ese nombre", field: "name" }
  }

  const created = await prisma.materialFolder.create({
    data: {
      parentId: parent.id,
      name: data.name,
      programLevelId: parent.programLevelId,
      createdById: user.id,
    },
    select: { id: true },
  })

  revalidatePath(`/admin/materiales/${parent.id}`)
  return { success: true, folderId: created.id }
}
