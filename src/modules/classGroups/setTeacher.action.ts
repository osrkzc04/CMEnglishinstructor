"use server"

import { revalidatePath } from "next/cache"
import { ClassGroupStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { validateTeacherForSlots } from "./eligibility"
import { notifyClassGroupAssignment } from "./emails"

type Result =
  | { success: true; assignmentId: string }
  | { success: false; error: string }

/**
 * Asigna o rota el docente del aula.
 *
 *  - Si hay asignación vigente, se cierra (`endDate = ayer`).
 *  - Se borran las `ClassSession` futuras todavía planificadas
 *    (`SCHEDULED` con `scheduledStart > ahora`). El módulo de calendario
 *    las regenera con el nuevo docente.
 *  - Se crea la nueva asignación abierta (`endDate = null`).
 *
 * La elegibilidad se valida antes de tocar nada (CEFR + slots cubiertos +
 * sin doble-booking contra otras aulas activas).
 */
export async function setClassGroupTeacher(args: {
  classGroupId: string
  teacherId: string
}): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const group = await prisma.classGroup.findUnique({
    where: { id: args.classGroupId },
    include: {
      programLevel: {
        include: { program: { include: { course: true } } },
      },
      slots: true,
    },
  })
  if (!group) return { success: false, error: "Aula no encontrada" }
  if (group.status !== ClassGroupStatus.ACTIVE) {
    return { success: false, error: "El aula no está activa" }
  }

  const conflict = await validateTeacherForSlots({
    teacherId: args.teacherId,
    cefrLevelCode: group.programLevel.cefrLevelCode,
    languageId: group.programLevel.program.course.languageId,
    slots: group.slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
    })),
    excludeClassGroupId: args.classGroupId,
  })
  if (!conflict) {
    return { success: false, error: "Docente no encontrado o inactivo" }
  }
  const reasons: string[] = []
  if (conflict.cefrMismatch) reasons.push("no cubre el nivel CEFR")
  if (conflict.uncoveredSlots.length > 0)
    reasons.push("no tiene disponibilidad para todos los horarios")
  if (conflict.doubleBookedSlots.length > 0) {
    const groups = [
      ...new Set(conflict.doubleBookedSlots.map((d) => d.classGroupName)),
    ].join(", ")
    reasons.push(`ya está dictando otra aula con horario solapado (${groups})`)
  }
  if (reasons.length > 0) {
    return {
      success: false,
      error: `El docente no es elegible: ${reasons.join("; ")}.`,
    }
  }

  const today = startOfTodayUTC()
  const yesterday = addDays(today, -1)
  const now = new Date()

  const assignment = await prisma.$transaction(async (tx) => {
    await tx.teacherAssignment.updateMany({
      where: {
        classGroupId: args.classGroupId,
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      data: { endDate: yesterday },
    })

    // Borrar sesiones futuras todavía planificadas — el nuevo docente las
    // regenera. Las que ya pasaron (con o sin `actualStart`) quedan
    // intactas como histórico.
    await tx.classSession.deleteMany({
      where: {
        classGroupId: args.classGroupId,
        status: "SCHEDULED",
        scheduledStart: { gt: now },
      },
    })

    return tx.teacherAssignment.create({
      data: {
        classGroupId: args.classGroupId,
        teacherId: args.teacherId,
        startDate: today,
        endDate: null,
      },
    })
  })

  // Notificar al docente nuevo y a todos los estudiantes activos del aula.
  // Si el aula no tiene alumnos, solo se notifica al docente.
  await notifyClassGroupAssignment({ classGroupId: args.classGroupId })

  revalidatePath(`/admin/aulas/${args.classGroupId}`)
  revalidatePath("/admin/aulas")
  return { success: true, assignmentId: assignment.id }
}

function startOfTodayUTC(): Date {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}
