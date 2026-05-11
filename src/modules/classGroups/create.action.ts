"use server"

import { revalidatePath } from "next/cache"
import { ClassGroupStatus, EnrollmentStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { getSettings } from "@/modules/settings"
import { generateClassGroupName } from "./nameGenerator"
import { validateTeacherForSlots } from "./eligibility"
import { notifyClassGroupAssignment } from "./emails"
import { NewClassGroupSchema, type NewClassGroupInput } from "./schemas"

type Result =
  | { success: true; classGroupId: string }
  | { success: false; error: string; field?: keyof NewClassGroupInput }

/**
 * Crea un aula. La duración por clase se snapshotea desde el `Course` del
 * `ProgramLevel` para que un cambio futuro de configuración no altere
 * aulas existentes.
 *
 * Si se pasa `teacherId`, se valida elegibilidad (CEFR + slots cubiertos +
 * sin doble-booking contra otras aulas activas) y se crea la primera
 * `TeacherAssignment`. Si se pasan `enrollmentIds`, se valida que cada
 * matrícula sea del mismo `ProgramLevel`, esté ACTIVE y no pertenezca a
 * otra aula.
 *
 * Sesiones (`ClassSession`): NO se materializan acá. El módulo de
 * calendario las genera cuando coordinación abre el horizonte. Esto
 * mantiene la action acotada y permite crear aulas placeholder sin docente.
 */
export async function createClassGroup(input: NewClassGroupInput): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = NewClassGroupSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof NewClassGroupInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const programLevel = await prisma.programLevel.findUnique({
    where: { id: data.programLevelId },
    include: { program: { include: { course: { include: { language: true } } } } },
  })
  if (!programLevel) {
    return { success: false, error: "Nivel no encontrado", field: "programLevelId" }
  }
  const classDuration = programLevel.program.course.classDuration

  // -----------------------------------------------------------------------
  //  Validación de carga semanal — settings configurables, defaults 2-10h
  // -----------------------------------------------------------------------
  const { weeklyMinHours, weeklyMaxHours } = await getSettings(["weeklyMinHours", "weeklyMaxHours"])
  const weeklyHours = (data.slots.length * classDuration) / 60
  if (weeklyHours < weeklyMinHours) {
    return {
      success: false,
      error: `El aula tiene ${weeklyHours} h/sem. El mínimo permitido es ${weeklyMinHours} h.`,
      field: "slots",
    }
  }
  if (weeklyHours > weeklyMaxHours) {
    return {
      success: false,
      error: `El aula tiene ${weeklyHours} h/sem. El máximo permitido es ${weeklyMaxHours} h.`,
      field: "slots",
    }
  }

  // -----------------------------------------------------------------------
  //  Pre-validación de matrículas: deben existir, estar libres de aula y
  //  ser del mismo programLevel. Lo chequeamos antes de la transacción
  //  para devolver mensajes claros sin abortar a mitad de camino.
  // -----------------------------------------------------------------------
  if (data.enrollmentIds.length > 0) {
    const found = await prisma.enrollment.findMany({
      where: { id: { in: data.enrollmentIds } },
      select: {
        id: true,
        programLevelId: true,
        classGroupId: true,
        status: true,
      },
    })
    if (found.length !== data.enrollmentIds.length) {
      return {
        success: false,
        error: "Alguna de las matrículas seleccionadas no existe",
        field: "enrollmentIds",
      }
    }
    const wrongLevel = found.find((e) => e.programLevelId !== data.programLevelId)
    if (wrongLevel) {
      return {
        success: false,
        error: "Hay matrículas de un nivel distinto al del aula",
        field: "enrollmentIds",
      }
    }
    const alreadyAssigned = found.find((e) => e.classGroupId !== null)
    if (alreadyAssigned) {
      return {
        success: false,
        error: "Hay matrículas que ya pertenecen a otra aula",
        field: "enrollmentIds",
      }
    }
    const notActive = found.find((e) => e.status !== EnrollmentStatus.ACTIVE)
    if (notActive) {
      return {
        success: false,
        error: "Solo se pueden agregar matrículas activas",
        field: "enrollmentIds",
      }
    }
  }

  // -----------------------------------------------------------------------
  //  Validación de elegibilidad del docente (si se pasa).
  // -----------------------------------------------------------------------
  if (data.teacherId) {
    const slotsForValidation = data.slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      durationMinutes: classDuration,
    }))
    const conflict = await validateTeacherForSlots({
      teacherId: data.teacherId,
      cefrLevelCode: programLevel.cefrLevelCode,
      languageId: programLevel.program.course.languageId,
      slots: slotsForValidation,
    })
    if (conflict) {
      const reasons: string[] = []
      if (conflict.cefrMismatch) reasons.push("no cubre el nivel CEFR")
      if (conflict.uncoveredSlots.length > 0)
        reasons.push("no tiene disponibilidad para todos los horarios")
      if (conflict.doubleBookedSlots.length > 0)
        reasons.push("ya está dictando otra aula con horario solapado")
      if (reasons.length > 0) {
        return {
          success: false,
          error: `El docente no es elegible: ${reasons.join("; ")}.`,
          field: "teacherId",
        }
      }
    }
  }

  const name =
    data.name ??
    generateClassGroupName({
      programName: programLevel.program.name,
      levelCode: programLevel.code,
      levelName: programLevel.name,
      slots: data.slots,
    })

  const today = startOfTodayUTC()

  const created = await prisma.$transaction(async (tx) => {
    const group = await tx.classGroup.create({
      data: {
        name,
        programLevelId: data.programLevelId,
        modality: data.modality,
        notes: data.notes ?? null,
        defaultMeetingUrl: data.defaultMeetingUrl ?? null,
        defaultLocation: data.defaultLocation ?? null,
        status: ClassGroupStatus.ACTIVE,
        slots: {
          create: data.slots.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            durationMinutes: classDuration,
          })),
        },
      },
    })

    if (data.teacherId) {
      await tx.teacherAssignment.create({
        data: {
          classGroupId: group.id,
          teacherId: data.teacherId,
          startDate: today,
          endDate: null,
        },
      })
    }

    if (data.enrollmentIds.length > 0) {
      await tx.enrollment.updateMany({
        where: { id: { in: data.enrollmentIds } },
        data: { classGroupId: group.id },
      })
    }

    return group
  })

  // Notificar por email a docente + estudiantes — fuera de transacción.
  // Si esto falla, el aula igual quedó creada y hay registro en
  // `EmailNotification` para reintentar. Solo enviamos si hay docente
  // asignado: sin docente no tendría link/horario "vivo".
  if (data.teacherId) {
    await notifyClassGroupAssignment({ classGroupId: created.id })
  }

  revalidatePath("/admin/aulas")
  return { success: true, classGroupId: created.id }
}

function startOfTodayUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}
