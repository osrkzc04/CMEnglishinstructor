import "server-only"
import { cache } from "react"
import {
  ClassGroupStatus,
  EnrollmentStatus,
  Modality,
  Prisma,
  SessionStatus,
  UserStatus,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  ClassGroupListFiltersSchema,
  type ClassGroupListFilters,
} from "./schemas"

/**
 * Lecturas del módulo `classGroups` (aulas).
 *
 * El detalle es la query más cargada (matrículas + slots + asignaciones de
 * docente). El listado va liviano: por aula solo metadatos, contadores, y
 * el docente vigente.
 */

// -----------------------------------------------------------------------------
//  Listado paginado
// -----------------------------------------------------------------------------

export type ClassGroupListItem = {
  id: string
  name: string
  programLabel: string
  cefrLevelCode: string | null
  modality: Modality
  status: ClassGroupStatus
  enrollmentsCount: number
  slotsCount: number
  currentTeacherName: string | null
  createdAt: Date
}

export type ClassGroupListResult = {
  items: ClassGroupListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function listClassGroups(
  raw: Partial<ClassGroupListFilters>,
): Promise<ClassGroupListResult> {
  const filters = ClassGroupListFiltersSchema.parse(raw)
  const where = buildListWhere(filters)
  const today = startOfTodayUTC()

  const [rows, total] = await prisma.$transaction([
    prisma.classGroup.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: {
        programLevel: {
          include: { program: { include: { course: true } } },
        },
        _count: { select: { enrollments: true, slots: true } },
        teacherAssignments: {
          where: {
            OR: [{ endDate: null }, { endDate: { gte: today } }],
          },
          take: 1,
          include: { teacher: { include: { user: true } } },
        },
      },
    }),
    prisma.classGroup.count({ where }),
  ])

  return {
    items: rows.map((g) => {
      const current = g.teacherAssignments[0]
      return {
        id: g.id,
        name: g.name,
        programLabel: `${g.programLevel.program.course.name} · ${g.programLevel.program.name} · ${g.programLevel.name}`,
        cefrLevelCode: g.programLevel.cefrLevelCode,
        modality: g.modality,
        status: g.status,
        enrollmentsCount: g._count.enrollments,
        slotsCount: g._count.slots,
        currentTeacherName: current
          ? `${current.teacher.user.firstName} ${current.teacher.user.lastName}`
          : null,
        createdAt: g.createdAt,
      }
    }),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  }
}

function buildListWhere(
  filters: ClassGroupListFilters,
): Prisma.ClassGroupWhereInput {
  const where: Prisma.ClassGroupWhereInput = {}
  if (filters.status) where.status = filters.status
  if (filters.programLevelId) where.programLevelId = filters.programLevelId
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      {
        programLevel: {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            {
              program: { name: { contains: filters.q, mode: "insensitive" } },
            },
          ],
        },
      },
    ]
  }
  return where
}

// -----------------------------------------------------------------------------
//  Detalle del aula
// -----------------------------------------------------------------------------

export type ClassGroupSlotRow = {
  id: string
  dayOfWeek: number
  startTime: string
  durationMinutes: number
}

export type ClassGroupEnrollmentRow = {
  enrollmentId: string
  studentId: string
  studentName: string
  studentEmail: string
  studentStatus: UserStatus
  enrollmentStatus: EnrollmentStatus
  joinedAt: Date
}

export type ClassGroupTeacherAssignmentRow = {
  id: string
  teacherId: string
  teacherName: string
  startDate: Date
  endDate: Date | null
  isCurrent: boolean
}

export type ClassGroupDetail = {
  id: string
  name: string
  modality: Modality
  status: ClassGroupStatus
  notes: string | null
  defaultMeetingUrl: string | null
  defaultLocation: string | null
  createdAt: Date
  closedAt: Date | null
  programLevel: {
    id: string
    code: string
    name: string
    programLabel: string
    cefrLevelCode: string | null
    classDurationMinutes: number
    languageId: string
  }
  slots: ClassGroupSlotRow[]
  enrollments: ClassGroupEnrollmentRow[]
  currentAssignment: ClassGroupTeacherAssignmentRow | null
  pastAssignments: ClassGroupTeacherAssignmentRow[]
}

export const getClassGroupDetail = cache(
  async (id: string): Promise<ClassGroupDetail | null> => {
    const today = startOfTodayUTC()
    const row = await prisma.classGroup.findUnique({
      where: { id },
      include: {
        programLevel: {
          include: {
            program: { include: { course: { include: { language: true } } } },
          },
        },
        slots: {
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        },
        enrollments: {
          orderBy: { createdAt: "asc" },
          include: { student: { include: { user: true } } },
        },
        teacherAssignments: {
          orderBy: { startDate: "desc" },
          include: { teacher: { include: { user: true } } },
        },
      },
    })
    if (!row) return null

    const assignmentRows: ClassGroupTeacherAssignmentRow[] =
      row.teacherAssignments.map((a) => ({
        id: a.id,
        teacherId: a.teacherId,
        teacherName: `${a.teacher.user.firstName} ${a.teacher.user.lastName}`,
        startDate: a.startDate,
        endDate: a.endDate,
        isCurrent:
          a.startDate <= today && (a.endDate === null || a.endDate >= today),
      }))

    const current = assignmentRows.find((a) => a.isCurrent) ?? null
    const past = assignmentRows.filter((a) => !a.isCurrent)

    return {
      id: row.id,
      name: row.name,
      modality: row.modality,
      status: row.status,
      notes: row.notes,
      defaultMeetingUrl: row.defaultMeetingUrl,
      defaultLocation: row.defaultLocation,
      createdAt: row.createdAt,
      closedAt: row.closedAt,
      programLevel: {
        id: row.programLevel.id,
        code: row.programLevel.code,
        name: row.programLevel.name,
        programLabel: `${row.programLevel.program.course.name} · ${row.programLevel.program.name} · ${row.programLevel.name}`,
        cefrLevelCode: row.programLevel.cefrLevelCode,
        classDurationMinutes: row.programLevel.program.course.classDuration,
        languageId: row.programLevel.program.course.language.id,
      },
      slots: row.slots.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        durationMinutes: s.durationMinutes,
      })),
      enrollments: row.enrollments.map((e) => ({
        enrollmentId: e.id,
        studentId: e.studentId,
        studentName: `${e.student.user.firstName} ${e.student.user.lastName}`,
        studentEmail: e.student.user.email,
        studentStatus: e.student.user.status,
        enrollmentStatus: e.status,
        joinedAt: e.createdAt,
      })),
      currentAssignment: current,
      pastAssignments: past,
    }
  },
)

// -----------------------------------------------------------------------------
//  Vistas para el docente — solo aulas donde es el docente vigente
// -----------------------------------------------------------------------------

export type TeacherClassGroupListItem = {
  id: string
  name: string
  programLabel: string
  cefrLevelCode: string | null
  modality: Modality
  status: ClassGroupStatus
  studentCount: number
  hasMeetingUrl: boolean
  slots: { dayOfWeek: number; startTime: string; durationMinutes: number }[]
}

/**
 * Listado de aulas del docente — solo aquellas en las que es el docente
 * vigente (`TeacherAssignment.endDate = null`). El estado del aula no se
 * filtra a propósito: si quedó en COMPLETED/CANCELLED, lo mostramos como
 * referencia pero las acciones de edición se deshabilitan en la UI.
 */
export async function listTeacherClassGroups(
  teacherId: string,
): Promise<TeacherClassGroupListItem[]> {
  const rows = await prisma.classGroup.findMany({
    where: {
      teacherAssignments: { some: { teacherId, endDate: null } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      programLevel: {
        include: { program: { include: { course: true } } },
      },
      slots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      _count: {
        select: { enrollments: { where: { status: EnrollmentStatus.ACTIVE } } },
      },
    },
  })

  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    programLabel: `${g.programLevel.program.course.name} · ${g.programLevel.program.name} · ${g.programLevel.name}`,
    cefrLevelCode: g.programLevel.cefrLevelCode,
    modality: g.modality,
    status: g.status,
    studentCount: g._count.enrollments,
    hasMeetingUrl: g.defaultMeetingUrl !== null && g.defaultMeetingUrl.length > 0,
    slots: g.slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
    })),
  }))
}

export type TeacherClassGroupDetail = {
  id: string
  name: string
  modality: Modality
  status: ClassGroupStatus
  defaultMeetingUrl: string | null
  defaultLocation: string | null
  createdAt: Date
  programLevel: {
    name: string
    programLabel: string
    cefrLevelCode: string | null
    classDurationMinutes: number
    totalHours: number
  }
  slots: ClassGroupSlotRow[]
  enrollments: {
    enrollmentId: string
    studentName: string
    studentEmail: string
    consumedHours: number
    totalHours: number
    joinedAt: Date
    status: EnrollmentStatus
  }[]
  upcomingSessions: ClassGroupUpcomingSession[]
}

/**
 * Detalle del aula para el docente. Devuelve `null` si el caller no es el
 * docente vigente — la página llama a `notFound()` con eso para no exponer
 * que el aula existe.
 */
export async function getTeacherClassGroupDetail(
  teacherId: string,
  classGroupId: string,
): Promise<TeacherClassGroupDetail | null> {
  const now = new Date()
  const row = await prisma.classGroup.findFirst({
    where: {
      id: classGroupId,
      teacherAssignments: { some: { teacherId, endDate: null } },
    },
    include: {
      programLevel: {
        include: { program: { include: { course: true } } },
      },
      slots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      enrollments: {
        orderBy: { createdAt: "asc" },
        include: {
          student: { include: { user: true } },
          programLevel: { select: { totalHours: true } },
        },
      },
    },
  })
  if (!row) return null

  const upcomingRows = await prisma.classSession.findMany({
    where: { classGroupId, scheduledStart: { gte: now } },
    orderBy: { scheduledStart: "asc" },
    take: 6,
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      status: true,
      _count: { select: { participants: true } },
    },
  })

  return {
    id: row.id,
    name: row.name,
    modality: row.modality,
    status: row.status,
    defaultMeetingUrl: row.defaultMeetingUrl,
    defaultLocation: row.defaultLocation,
    createdAt: row.createdAt,
    programLevel: {
      name: row.programLevel.name,
      programLabel: `${row.programLevel.program.course.name} · ${row.programLevel.program.name} · ${row.programLevel.name}`,
      cefrLevelCode: row.programLevel.cefrLevelCode,
      classDurationMinutes: row.programLevel.program.course.classDuration,
      totalHours: Number(row.programLevel.totalHours),
    },
    slots: row.slots.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
    })),
    enrollments: row.enrollments.map((e) => ({
      enrollmentId: e.id,
      studentName: `${e.student.user.firstName} ${e.student.user.lastName}`,
      studentEmail: e.student.user.email,
      consumedHours: Number(e.consumedHours),
      totalHours: Number(e.programLevel.totalHours),
      joinedAt: e.createdAt,
      status: e.status,
    })),
    upcomingSessions: upcomingRows.map((s) => ({
      id: s.id,
      scheduledStart: s.scheduledStart,
      scheduledEnd: s.scheduledEnd,
      status: s.status,
      participantCount: s._count.participants,
    })),
  }
}

// -----------------------------------------------------------------------------
//  Aulas activas para un nivel — usado en el wizard "elegir o crear aula"
// -----------------------------------------------------------------------------

export type ClassGroupForLevelOption = {
  id: string
  name: string
  modality: Modality
  enrollmentsCount: number
  slots: { dayOfWeek: number; startTime: string }[]
  currentTeacherName: string | null
}

export const listActiveClassGroupsForLevel = cache(
  async (programLevelId: string): Promise<ClassGroupForLevelOption[]> => {
    const today = startOfTodayUTC()
    const rows = await prisma.classGroup.findMany({
      where: {
        programLevelId,
        status: ClassGroupStatus.ACTIVE,
      },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { enrollments: true } },
        slots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
        teacherAssignments: {
          where: { OR: [{ endDate: null }, { endDate: { gte: today } }] },
          take: 1,
          include: { teacher: { include: { user: true } } },
        },
      },
    })
    return rows.map((g) => ({
      id: g.id,
      name: g.name,
      modality: g.modality,
      enrollmentsCount: g._count.enrollments,
      slots: g.slots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
      })),
      currentTeacherName: g.teacherAssignments[0]
        ? `${g.teacherAssignments[0].teacher.user.firstName} ${g.teacherAssignments[0].teacher.user.lastName}`
        : null,
    }))
  },
)

// -----------------------------------------------------------------------------
//  Aulas activas para "planear inscripción" — usado por el form de alta de
//  estudiante para mostrar todas las opciones; el cliente filtra por
//  `programLevelId` + `modality` cuando el coordinador define la matrícula.
// -----------------------------------------------------------------------------

export type ClassGroupForPlanningOption = {
  id: string
  name: string
  programLevelId: string
  modality: Modality
  enrollmentsCount: number
  slotsLabel: string
  currentTeacherName: string | null
}

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

export const listActiveClassGroupsForPlanning = cache(
  async (): Promise<ClassGroupForPlanningOption[]> => {
    const today = startOfTodayUTC()
    const rows = await prisma.classGroup.findMany({
      where: { status: ClassGroupStatus.ACTIVE },
      orderBy: [{ programLevelId: "asc" }, { name: "asc" }],
      include: {
        slots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
        _count: { select: { enrollments: true } },
        teacherAssignments: {
          where: { OR: [{ endDate: null }, { endDate: { gte: today } }] },
          take: 1,
          include: { teacher: { include: { user: true } } },
        },
      },
    })
    return rows.map((g) => ({
      id: g.id,
      name: g.name,
      programLevelId: g.programLevelId,
      modality: g.modality,
      enrollmentsCount: g._count.enrollments,
      slotsLabel: formatSlotsLabel(g.slots),
      currentTeacherName: g.teacherAssignments[0]
        ? `${g.teacherAssignments[0].teacher.user.firstName} ${g.teacherAssignments[0].teacher.user.lastName}`
        : null,
    }))
  },
)

function formatSlotsLabel(
  slots: { dayOfWeek: number; startTime: string }[],
): string {
  if (slots.length === 0) return "—"
  const orderedDays = [1, 2, 3, 4, 5, 6, 0]
  const daySet = new Set(slots.map((s) => s.dayOfWeek))
  const days = orderedDays
    .filter((d) => daySet.has(d))
    .map((d) => DAY_SHORT[d])
  const earliest = [...slots].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  )[0]?.startTime
  return earliest ? `${days.join("-")} ${earliest}` : days.join("-")
}

// -----------------------------------------------------------------------------
//  Matrículas elegibles para sumarse a un aula — mismo programLevel, sin
//  classGroup asignado, status ACTIVE.
// -----------------------------------------------------------------------------

export type EligibleEnrollmentOption = {
  enrollmentId: string
  studentId: string
  studentName: string
  studentEmail: string
}

export async function listEligibleEnrollmentsForGroup(
  classGroupId: string,
): Promise<EligibleEnrollmentOption[]> {
  const group = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    select: { programLevelId: true },
  })
  if (!group) return []

  const rows = await prisma.enrollment.findMany({
    where: {
      programLevelId: group.programLevelId,
      classGroupId: null,
      status: EnrollmentStatus.ACTIVE,
    },
    orderBy: { createdAt: "desc" },
    include: { student: { include: { user: true } } },
  })

  return rows.map((e) => ({
    enrollmentId: e.id,
    studentId: e.studentId,
    studentName: `${e.student.user.firstName} ${e.student.user.lastName}`,
    studentEmail: e.student.user.email,
  }))
}

// -----------------------------------------------------------------------------
//  Sesiones materializadas del aula
// -----------------------------------------------------------------------------

export type ClassGroupUpcomingSession = {
  id: string
  scheduledStart: Date
  scheduledEnd: Date
  status: SessionStatus
  participantCount: number
}

export type ClassGroupSessionsSummary = {
  futureCount: number
  pastCount: number
  upcoming: ClassGroupUpcomingSession[]
  /** Última fecha programada (UTC). Útil para sugerir el rango siguiente. */
  lastScheduledStart: Date | null
}

export async function getClassGroupSessionsSummary(
  classGroupId: string,
): Promise<ClassGroupSessionsSummary> {
  const now = new Date()
  const [futureCount, pastCount, upcomingRows, lastRow] = await Promise.all([
    prisma.classSession.count({
      where: { classGroupId, scheduledStart: { gte: now } },
    }),
    prisma.classSession.count({
      where: { classGroupId, scheduledStart: { lt: now } },
    }),
    prisma.classSession.findMany({
      where: { classGroupId, scheduledStart: { gte: now } },
      orderBy: { scheduledStart: "asc" },
      take: 6,
      select: {
        id: true,
        scheduledStart: true,
        scheduledEnd: true,
        status: true,
        _count: { select: { participants: true } },
      },
    }),
    prisma.classSession.findFirst({
      where: { classGroupId },
      orderBy: { scheduledStart: "desc" },
      select: { scheduledStart: true },
    }),
  ])

  return {
    futureCount,
    pastCount,
    upcoming: upcomingRows.map((s) => ({
      id: s.id,
      scheduledStart: s.scheduledStart,
      scheduledEnd: s.scheduledEnd,
      status: s.status,
      participantCount: s._count.participants,
    })),
    lastScheduledStart: lastRow?.scheduledStart ?? null,
  }
}

// -----------------------------------------------------------------------------
//  Candidatos para el matchmaker del alta de aula
// -----------------------------------------------------------------------------

export type EligibleStudentCandidate = {
  enrollmentId: string
  studentId: string
  fullName: string
  email: string
  preferredSchedule: { dayOfWeek: number; startTime: string; endTime: string }[]
}

/**
 * Estudiantes elegibles para sumar a un aula nueva del nivel dado:
 *   - User ACTIVE
 *   - Enrollment ACTIVE en ese ProgramLevel
 *   - Sin classGroup asignado (el aula los va a recibir)
 *
 * Se trae el horario preferido para que el cliente compute la grilla de
 * intersección. Estudiantes sin horario quedan al final como "sin horario
 * cargado" — coordinación puede sumarlos pero el heatmap no los cuenta.
 */
export async function listEligibleStudentsForLevel(
  programLevelId: string,
): Promise<EligibleStudentCandidate[]> {
  const rows = await prisma.enrollment.findMany({
    where: {
      programLevelId,
      status: EnrollmentStatus.ACTIVE,
      classGroupId: null,
      student: { user: { status: "ACTIVE" } },
    },
    orderBy: [{ student: { user: { firstName: "asc" } } }],
    select: {
      id: true,
      studentId: true,
      student: {
        select: {
          user: { select: { firstName: true, lastName: true, email: true } },
          preferredSchedule: {
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
            select: { dayOfWeek: true, startTime: true, endTime: true },
          },
        },
      },
    },
  })

  return rows.map((r) => ({
    enrollmentId: r.id,
    studentId: r.studentId,
    fullName: `${r.student.user.firstName} ${r.student.user.lastName}`,
    email: r.student.user.email,
    preferredSchedule: r.student.preferredSchedule,
  }))
}

export type EligibleTeacherCandidate = {
  id: string
  fullName: string
  email: string
  hourlyRate: string
  /** Disponibilidad recurrente del docente. */
  availability: { dayOfWeek: number; startTime: string; endTime: string }[]
  /**
   * Slots ya bloqueados por aulas activas vigentes — el heatmap los renderea
   * como "ocupado" para que el coordinador no proponga ese horario.
   */
  conflicts: {
    dayOfWeek: number
    startTime: string
    durationMinutes: number
    classGroupName: string
  }[]
  /** True si cubre el CEFR del nivel (o el nivel no tiene CEFR). */
  cefrMatch: boolean
}

/**
 * Docentes elegibles para un aula del nivel dado:
 *   - TeacherProfile.isActive y User ACTIVE
 *   - cefrMatch: cubre el CEFR del nivel (si el nivel lo tiene)
 *
 * Se devuelven todos para que coordinación vea las opciones, con `cefrMatch`
 * para resaltar quiénes cuadran. Los conflictos vigentes se enumeran como
 * tuplas (día, hora, duración) lo cual el heatmap usa para bloquear celdas.
 */
export async function listEligibleTeachersForLevel(
  programLevelId: string,
): Promise<EligibleTeacherCandidate[]> {
  const level = await prisma.programLevel.findUnique({
    where: { id: programLevelId },
    select: {
      cefrLevelCode: true,
      program: { select: { course: { select: { languageId: true } } } },
    },
  })
  if (!level) return []

  const cefrCode = level.cefrLevelCode
  const languageId = level.program.course.languageId
  const today = startOfTodayUTC()

  const teachers = await prisma.teacherProfile.findMany({
    where: { isActive: true, user: { status: "ACTIVE" } },
    orderBy: [{ user: { firstName: "asc" } }],
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      teachableLevels: { include: { level: true } },
      availability: {
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
      teacherAssignments: {
        where: {
          OR: [{ endDate: null }, { endDate: { gte: today } }],
          classGroup: { status: ClassGroupStatus.ACTIVE },
        },
        select: {
          classGroup: {
            select: {
              name: true,
              slots: { select: { dayOfWeek: true, startTime: true, durationMinutes: true } },
            },
          },
        },
      },
    },
  })

  return teachers.map<EligibleTeacherCandidate>((t) => {
    const cefrMatch =
      cefrCode === null ||
      t.teachableLevels.some(
        (tl) => tl.level.languageId === languageId && tl.level.code === cefrCode,
      )

    const conflicts = t.teacherAssignments.flatMap((a) =>
      a.classGroup.slots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        durationMinutes: s.durationMinutes,
        classGroupName: a.classGroup.name,
      })),
    )

    return {
      id: t.userId,
      fullName: `${t.user.firstName} ${t.user.lastName}`,
      email: t.user.email,
      hourlyRate: t.hourlyRate.toString(),
      availability: t.availability,
      conflicts,
      cefrMatch,
    }
  })
}

// -----------------------------------------------------------------------------
//  Helpers
// -----------------------------------------------------------------------------

function startOfTodayUTC(): Date {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
}
