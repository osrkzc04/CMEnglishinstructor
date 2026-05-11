"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireAuth } from "@/modules/auth/guards"
import {
  StudentScheduleSchema,
  type StudentScheduleInput,
} from "./schemas"

type Result =
  | { success: true }
  | { success: false; error: string; field?: keyof StudentScheduleInput }

/**
 * Reemplaza el horario semanal preferido del estudiante (delete-all + insert).
 *
 * Autorización: lo puede actualizar coordinación/dirección O el propio
 * estudiante para su registro. No reciclamos `requireRole` porque queremos
 * permitir que el alumno se autoadministre desde `/estudiante/horario`.
 */
export async function updateStudentPreferredSchedule(
  studentId: string,
  input: StudentScheduleInput,
): Promise<Result> {
  const user = await requireAuth()

  const isAdmin = user.role === "DIRECTOR" || user.role === "COORDINATOR"
  const isSelf = user.role === "STUDENT" && user.id === studentId
  if (!isAdmin && !isSelf) throw new ForbiddenError()

  const parsed = StudentScheduleSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof StudentScheduleInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const profile = await prisma.studentProfile.findUnique({ where: { userId: studentId } })
  if (!profile) return { success: false, error: "Estudiante no encontrado" }

  await prisma.$transaction(async (tx) => {
    await tx.studentPreferredSchedule.deleteMany({ where: { studentId } })
    if (data.blocks.length > 0) {
      await tx.studentPreferredSchedule.createMany({
        data: data.blocks.map((b) => ({
          studentId,
          dayOfWeek: b.dayOfWeek,
          startTime: b.startTime,
          endTime: b.endTime,
        })),
      })
    }
  })

  revalidatePath("/admin/estudiantes")
  revalidatePath(`/admin/estudiantes/${studentId}`)
  if (isSelf) revalidatePath("/estudiante/horario")
  return { success: true }
}
