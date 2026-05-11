"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { TeacherLevelsSchema, type TeacherLevelsInput } from "./schemas"

type Result =
  | { success: true }
  | { success: false; error: string; field?: keyof TeacherLevelsInput }

/**
 * Edita los niveles CEFR que el docente puede dictar.
 *
 * Estrategia: delete-all + insert. La cantidad esperada (<20 filas por
 * docente) hace innecesario diff-ear el delta.
 */
export async function updateTeacherLevels(id: string, input: TeacherLevelsInput): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = TeacherLevelsSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof TeacherLevelsInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const target = await prisma.teacherProfile.findUnique({ where: { userId: id } })
  if (!target) return { success: false, error: "Docente no encontrado" }

  await prisma.$transaction(async (tx) => {
    await tx.teacherLevel.deleteMany({ where: { teacherId: id } })
    await tx.teacherLevel.createMany({
      data: data.levelIds.map((levelId) => ({ teacherId: id, levelId })),
    })
  })

  revalidatePath("/admin/docentes")
  revalidatePath(`/admin/docentes/${id}`)
  return { success: true }
}
