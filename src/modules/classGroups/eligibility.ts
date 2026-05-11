import "server-only"
import { ClassGroupStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  candidateIsEligible,
  slotIsCovered,
  slotsOverlap,
  type ConflictReport,
  type SlotPattern,
  type TeacherCandidate,
} from "./eligibility-shared"

/**
 * Determina qué docentes son elegibles para asignarse a un aula.
 *
 * Un docente es elegible si:
 *   (a) está activo (`isActive = true` y `status = ACTIVE`)
 *   (b) cubre el CEFR del nivel del aula (cuando el nivel tiene
 *       `cefrLevelCode`; los niveles sin CEFR — kids, modulares — no
 *       gatillan este chequeo)
 *   (c) `TeacherAvailability` cubre TODOS los slots del aula
 *   (d) NO tiene `TeacherAssignment` vigente con overlap de slots contra
 *       otra aula
 *
 * Devolvemos todos los docentes con su detalle de conflictos para que la UI
 * pueda mostrar candidatos parciales con la razón concreta del bloqueo —
 * la coordinación necesita ver "este podría dictar, pero choca con
 * matrícula X" para tomar decisiones informadas.
 *
 * Los tipos y predicados puros viven en `eligibility-shared.ts` para que
 * componentes cliente puedan consumirlos sin arrastrar Prisma al bundle.
 * Acá los re-exportamos para que los consumidores server (actions,
 * páginas) sigan importando todo desde un único módulo.
 */

export { candidateIsEligible, slotIsCovered, slotsOverlap }
export type { ConflictReport, SlotPattern, TeacherCandidate }

export async function findCandidatesForClassGroup(args: { classGroupId: string }): Promise<{
  group: {
    id: string
    name: string
    cefrLevelCode: string | null
    languageId: string
    classDurationMinutes: number
    slots: SlotPattern[]
  }
  candidates: TeacherCandidate[]
}> {
  const group = await prisma.classGroup.findUnique({
    where: { id: args.classGroupId },
    include: {
      programLevel: {
        include: {
          program: { include: { course: { include: { language: true } } } },
        },
      },
      slots: true,
    },
  })
  if (!group) throw new Error("Aula no encontrada")

  const cefrCode = group.programLevel.cefrLevelCode
  const languageId = group.programLevel.program.course.languageId
  const slots: SlotPattern[] = group.slots.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    durationMinutes: s.durationMinutes,
  }))

  const teachers = await prisma.teacherProfile.findMany({
    where: { isActive: true, user: { status: "ACTIVE" } },
    include: {
      user: true,
      teachableLevels: { include: { level: true } },
      availability: true,
    },
  })

  // Asignaciones vigentes en otras aulas activas — fuente del doble-booking.
  const today = startOfTodayUTC()
  const activeAssignments = await prisma.teacherAssignment.findMany({
    where: {
      OR: [{ endDate: null }, { endDate: { gte: today } }],
      classGroup: { status: ClassGroupStatus.ACTIVE },
      NOT: { classGroupId: args.classGroupId },
    },
    include: {
      classGroup: { include: { slots: true } },
    },
  })

  const conflictsByTeacher = new Map<string, typeof activeAssignments>()
  for (const a of activeAssignments) {
    const list = conflictsByTeacher.get(a.teacherId) ?? []
    list.push(a)
    conflictsByTeacher.set(a.teacherId, list)
  }

  const candidates = teachers.map<TeacherCandidate>((t) => {
    const cefrMismatch =
      cefrCode !== null &&
      !t.teachableLevels.some(
        (tl) => tl.level.languageId === languageId && tl.level.code === cefrCode,
      )

    const uncoveredSlots = slots
      .filter((s) => !slotIsCovered(s, t.availability))
      .map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime }))

    const teacherConflicts = conflictsByTeacher.get(t.userId) ?? []
    const doubleBookedSlots: ConflictReport["doubleBookedSlots"] = []
    for (const slot of slots) {
      for (const conflict of teacherConflicts) {
        const overlapping = conflict.classGroup.slots.find((cs) =>
          slotsOverlap(slot, {
            dayOfWeek: cs.dayOfWeek,
            startTime: cs.startTime,
            durationMinutes: cs.durationMinutes,
          }),
        )
        if (overlapping) {
          doubleBookedSlots.push({
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            classGroupId: conflict.classGroupId,
            classGroupName: conflict.classGroup.name,
          })
          break
        }
      }
    }

    return {
      id: t.userId,
      firstName: t.user.firstName,
      lastName: t.user.lastName,
      email: t.user.email,
      hourlyRate: t.hourlyRate.toString(),
      availability: t.availability.map((a) => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
      conflicts: { cefrMismatch, uncoveredSlots, doubleBookedSlots },
    }
  })

  // Elegibles arriba; dentro de cada bucket, alfabético.
  candidates.sort((a, b) => {
    const aOk = candidateIsEligible(a) ? 0 : 1
    const bOk = candidateIsEligible(b) ? 0 : 1
    if (aOk !== bOk) return aOk - bOk
    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
  })

  return {
    group: {
      id: group.id,
      name: group.name,
      cefrLevelCode: cefrCode,
      languageId,
      classDurationMinutes: group.programLevel.program.course.classDuration,
      slots,
    },
    candidates,
  }
}

// -----------------------------------------------------------------------------
//  Helpers internos
// -----------------------------------------------------------------------------

function startOfTodayUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

// -----------------------------------------------------------------------------
//  Validación standalone — usada desde `create.action` cuando todavía no hay
//  classGroupId. Recibe los slots propuestos y devuelve si el docente cabe.
// -----------------------------------------------------------------------------

export async function validateTeacherForSlots(args: {
  teacherId: string
  cefrLevelCode: string | null
  languageId: string
  slots: SlotPattern[]
  /** Aula a excluir de los chequeos de overlap (al editar una existente). */
  excludeClassGroupId?: string
}): Promise<ConflictReport | null> {
  const teacher = await prisma.teacherProfile.findFirst({
    where: { userId: args.teacherId, isActive: true },
    include: {
      user: true,
      teachableLevels: { include: { level: true } },
      availability: true,
    },
  })
  if (!teacher || teacher.user.status !== "ACTIVE") {
    return {
      cefrMismatch: false,
      uncoveredSlots: [],
      doubleBookedSlots: [],
    }
  }

  const cefrMismatch =
    args.cefrLevelCode !== null &&
    !teacher.teachableLevels.some(
      (tl) => tl.level.languageId === args.languageId && tl.level.code === args.cefrLevelCode,
    )

  const uncoveredSlots = args.slots
    .filter((s) => !slotIsCovered(s, teacher.availability))
    .map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime }))

  const today = startOfTodayUTC()
  const activeAssignments = await prisma.teacherAssignment.findMany({
    where: {
      teacherId: args.teacherId,
      OR: [{ endDate: null }, { endDate: { gte: today } }],
      classGroup: { status: ClassGroupStatus.ACTIVE },
      ...(args.excludeClassGroupId ? { NOT: { classGroupId: args.excludeClassGroupId } } : {}),
    },
    include: { classGroup: { include: { slots: true } } },
  })

  const doubleBookedSlots: ConflictReport["doubleBookedSlots"] = []
  for (const slot of args.slots) {
    for (const a of activeAssignments) {
      const overlap = a.classGroup.slots.find((cs) =>
        slotsOverlap(slot, {
          dayOfWeek: cs.dayOfWeek,
          startTime: cs.startTime,
          durationMinutes: cs.durationMinutes,
        }),
      )
      if (overlap) {
        doubleBookedSlots.push({
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          classGroupId: a.classGroupId,
          classGroupName: a.classGroup.name,
        })
        break
      }
    }
  }

  return { cefrMismatch, uncoveredSlots, doubleBookedSlots }
}
