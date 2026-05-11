"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireAuth } from "@/modules/auth/guards"
import {
  TeacherAvailabilitySchema,
  type TeacherAvailabilityInput,
} from "./schemas"

type Result =
  | { success: true }
  | { success: false; error: string; field?: keyof TeacherAvailabilityInput }

/**
 * Reemplaza la disponibilidad semanal del docente. La grilla del cliente
 * envía bloques compactados (`[start, end]` por día); acá los persistimos
 * con delete-all + insert.
 *
 * Autorización: dirección/coordinación O el propio docente (autoservicio
 * desde `/docente/disponibilidad`).
 *
 * Importante: cambiar la disponibilidad NO retro-elimina asignaciones que ya
 * estén dictándose. Si una clase materializada queda fuera del nuevo patrón,
 * se mantiene como excepción explícita (la coordinación decidirá si rota
 * docente o ajusta el horario).
 */
export async function updateTeacherAvailability(
  id: string,
  input: TeacherAvailabilityInput,
): Promise<Result> {
  const user = await requireAuth()
  const isAdmin = user.role === "DIRECTOR" || user.role === "COORDINATOR"
  const isSelf = user.role === "TEACHER" && user.id === id
  if (!isAdmin && !isSelf) throw new ForbiddenError()

  const parsed = TeacherAvailabilitySchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof TeacherAvailabilityInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const target = await prisma.teacherProfile.findUnique({ where: { userId: id } })
  if (!target) return { success: false, error: "Docente no encontrado" }

  await prisma.$transaction(async (tx) => {
    await tx.teacherAvailability.deleteMany({ where: { teacherId: id } })
    if (data.blocks.length > 0) {
      await tx.teacherAvailability.createMany({
        data: data.blocks.map((b) => ({
          teacherId: id,
          dayOfWeek: b.dayOfWeek,
          startTime: b.startTime,
          endTime: b.endTime,
        })),
      })
    }
  })

  revalidatePath("/admin/docentes")
  revalidatePath(`/admin/docentes/${id}`)
  if (isSelf) revalidatePath("/docente/disponibilidad")
  return { success: true }
}
