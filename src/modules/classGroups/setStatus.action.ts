"use server"

import { revalidatePath } from "next/cache"
import { ClassGroupStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { SetClassGroupStatusSchema, type SetClassGroupStatusInput } from "./schemas"

type Result = { success: true } | { success: false; error: string }

/**
 * Cambia el estado del aula a COMPLETED o CANCELLED.
 *
 *  - COMPLETED: el ciclo terminó sanamente (todos los alumnos completaron
 *    el nivel). Cierra la asignación vigente del docente.
 *  - CANCELLED: el aula se disuelve antes de tiempo. Las matrículas
 *    quedan flotando (`classGroupId = null`) para que coordinación
 *    decida re-ubicarlas o no.
 *
 * En ambos casos NO se borra histórico — las `ClassSession` ya
 * materializadas y sus `ClassParticipant` permanecen para que la bitácora
 * y el cálculo de payroll sigan siendo consultables.
 */
export async function setClassGroupStatus(
  classGroupId: string,
  input: SetClassGroupStatusInput,
): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = SetClassGroupStatusSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Estado inválido",
    }
  }
  const target = parsed.data.status

  const current = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    select: { status: true },
  })
  if (!current) return { success: false, error: "Aula no encontrada" }
  if (current.status !== ClassGroupStatus.ACTIVE) {
    return { success: false, error: "Solo se pueden cerrar aulas activas" }
  }

  const today = startOfTodayUTC()
  const yesterday = addDays(today, -1)

  await prisma.$transaction(async (tx) => {
    await tx.classGroup.update({
      where: { id: classGroupId },
      data: { status: target, closedAt: new Date() },
    })

    // Cerrar asignación vigente — el docente "deja" el aula.
    await tx.teacherAssignment.updateMany({
      where: {
        classGroupId,
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      data: { endDate: yesterday },
    })

    // Si se cancela, soltamos las matrículas para que puedan re-asignarse.
    if (target === ClassGroupStatus.CANCELLED) {
      await tx.enrollment.updateMany({
        where: { classGroupId },
        data: { classGroupId: null },
      })
    }
  })

  revalidatePath("/admin/aulas")
  revalidatePath(`/admin/aulas/${classGroupId}`)
  return { success: true }
}

function startOfTodayUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}
