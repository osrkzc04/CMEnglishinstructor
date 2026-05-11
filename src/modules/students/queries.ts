import "server-only"
import { cache } from "react"
import { Prisma, UserStatus, EnrollmentStatus, Modality } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  StudentListFiltersSchema,
  type StudentListFilters,
} from "./schemas"

/**
 * Lectura de estudiantes para el panel admin. Centraliza el listado paginado
 * + búsqueda + filtros, el detalle por id usado al editar y agregaciones del
 * KPI strip que muestra la pantalla.
 *
 * Importante: trabajamos con `User where role = STUDENT`. El `StudentProfile`
 * es opcional en el schema (relación 0/1), por lo que toleramos su ausencia.
 */

export type StudentListItem = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  document: string | null
  status: UserStatus
  company: string | null
  position: string | null
  createdAt: Date
  activeEnrollments: number
}

export type StudentListResult = {
  items: StudentListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function listStudents(
  raw: Partial<StudentListFilters>,
): Promise<StudentListResult> {
  const filters = StudentListFiltersSchema.parse(raw)
  const where = buildWhere(filters)

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: {
        studentProfile: {
          include: {
            _count: {
              select: {
                enrollments: { where: { status: EnrollmentStatus.ACTIVE } },
              },
            },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  return {
    items: items.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      document: row.document,
      status: row.status,
      company: row.studentProfile?.company ?? null,
      position: row.studentProfile?.position ?? null,
      createdAt: row.createdAt,
      activeEnrollments: row.studentProfile?._count.enrollments ?? 0,
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  }
}

function buildWhere(filters: StudentListFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { role: "STUDENT" }
  if (filters.status) where.status = filters.status
  if (filters.q) {
    where.OR = [
      { firstName: { contains: filters.q, mode: "insensitive" } },
      { lastName: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
      { document: { contains: filters.q, mode: "insensitive" } },
      {
        studentProfile: {
          company: { contains: filters.q, mode: "insensitive" },
        },
      },
    ]
  }
  return where
}

// -----------------------------------------------------------------------------
//  Detalle por id (para precargar el form en modo edición)
// -----------------------------------------------------------------------------

export type StudentDetail = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  document: string | null
  status: UserStatus
  company: string | null
  position: string | null
  notes: string | null
}

export const getStudentById = cache(
  async (id: string): Promise<StudentDetail | null> => {
    const row = await prisma.user.findFirst({
      where: { id, role: "STUDENT" },
      include: { studentProfile: true },
    })
    if (!row) return null
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      document: row.document,
      status: row.status,
      company: row.studentProfile?.company ?? null,
      position: row.studentProfile?.position ?? null,
      notes: row.studentProfile?.notes ?? null,
    }
  },
)

// -----------------------------------------------------------------------------
//  Detalle completo (página `/admin/estudiantes/[id]`): datos personales +
//  matrículas con su aula asignada (si la tienen) y el docente vigente.
// -----------------------------------------------------------------------------

export type StudentEnrollmentDetail = {
  id: string
  status: EnrollmentStatus
  programLabel: string
  cefrLevelCode: string | null
  classDurationMinutes: number
  modality: Modality
  notes: string | null
  createdAt: Date
  closedAt: Date | null
  consumedHours: number
  totalHours: number
  /**
   * Aula asignada a esta matrícula. Si es `null`, la matrícula está "en
   * espera de aula" — la coordinación todavía no la colocó en un grupo.
   */
  classGroup: {
    id: string
    name: string
    slots: { dayOfWeek: number; startTime: string; durationMinutes: number }[]
    currentTeacher: {
      teacherId: string
      teacherName: string
      since: Date
    } | null
  } | null
}

export type StudentFullDetail = StudentDetail & {
  createdAt: Date
  enrollments: StudentEnrollmentDetail[]
  preferredSchedule: { dayOfWeek: number; startTime: string; endTime: string }[]
}

export const getStudentFullDetail = cache(
  async (id: string): Promise<StudentFullDetail | null> => {
    const today = startOfTodayUTC()
    const row = await prisma.user.findFirst({
      where: { id, role: "STUDENT" },
      include: {
        studentProfile: {
          include: {
            preferredSchedule: {
              orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
            },
            enrollments: {
              orderBy: [{ status: "asc" }, { createdAt: "desc" }],
              include: {
                programLevel: {
                  include: {
                    program: { include: { course: true } },
                  },
                },
                classGroup: {
                  include: {
                    slots: {
                      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
                    },
                    teacherAssignments: {
                      orderBy: { startDate: "desc" },
                      include: { teacher: { include: { user: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
    if (!row) return null

    const enrollments: StudentEnrollmentDetail[] = (
      row.studentProfile?.enrollments ?? []
    ).map((e) => {
      const group = e.classGroup
      const currentAssignment = group?.teacherAssignments.find(
        (a) => a.startDate <= today && (a.endDate === null || a.endDate >= today),
      )
      return {
        id: e.id,
        status: e.status,
        programLabel: `${e.programLevel.program.course.name} · ${e.programLevel.program.name} · ${e.programLevel.name}`,
        cefrLevelCode: e.programLevel.cefrLevelCode,
        classDurationMinutes: e.programLevel.program.course.classDuration,
        modality: e.modality,
        notes: e.notes,
        createdAt: e.createdAt,
        closedAt: e.closedAt,
        consumedHours: Number(e.consumedHours),
        totalHours: Number(e.programLevel.totalHours),
        classGroup: group
          ? {
              id: group.id,
              name: group.name,
              slots: group.slots.map((s) => ({
                dayOfWeek: s.dayOfWeek,
                startTime: s.startTime,
                durationMinutes: s.durationMinutes,
              })),
              currentTeacher: currentAssignment
                ? {
                    teacherId: currentAssignment.teacherId,
                    teacherName: `${currentAssignment.teacher.user.firstName} ${currentAssignment.teacher.user.lastName}`,
                    since: currentAssignment.startDate,
                  }
                : null,
            }
          : null,
      }
    })

    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      document: row.document,
      status: row.status,
      company: row.studentProfile?.company ?? null,
      position: row.studentProfile?.position ?? null,
      notes: row.studentProfile?.notes ?? null,
      createdAt: row.createdAt,
      enrollments,
      preferredSchedule: (row.studentProfile?.preferredSchedule ?? []).map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    }
  },
)

/**
 * Carga el horario preferido en aislamiento — usado por la página de
 * autoservicio del estudiante para no traer el resto del perfil.
 */
export async function getStudentPreferredSchedule(
  userId: string,
): Promise<{ dayOfWeek: number; startTime: string; endTime: string }[]> {
  const rows = await prisma.studentPreferredSchedule.findMany({
    where: { studentId: userId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    select: { dayOfWeek: true, startTime: true, endTime: true },
  })
  return rows
}

function startOfTodayUTC(): Date {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
}

// -----------------------------------------------------------------------------
//  KPIs del strip (totales por estado + matrículas activas)
// -----------------------------------------------------------------------------

export type StudentStats = {
  total: number
  active: number
  inactive: number
  pendingApproval: number
  activeEnrollments: number
}

export const getStudentStats = cache(async (): Promise<StudentStats> => {
  const [total, active, inactive, pendingApproval, activeEnrollments] =
    await prisma.$transaction([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
      prisma.user.count({ where: { role: "STUDENT", status: "INACTIVE" } }),
      prisma.user.count({
        where: { role: "STUDENT", status: "PENDING_APPROVAL" },
      }),
      prisma.enrollment.count({ where: { status: "ACTIVE" } }),
    ])
  return { total, active, inactive, pendingApproval, activeEnrollments }
})

// -----------------------------------------------------------------------------
//  Dashboard del estudiante
// -----------------------------------------------------------------------------

export type StudentDashboardEnrollment = {
  enrollmentId: string
  programLevelId: string
  programName: string
  levelName: string
  modality: string
  rootFolderId: string | null
  consumedHours: number
  totalHours: number
  classGroup: {
    id: string
    name: string
    slots: { dayOfWeek: number; startTime: string }[]
    currentTeacher: { id: string; name: string } | null
  } | null
}

export type StudentNextClass = {
  id: string
  scheduledStart: Date
  scheduledEnd: Date
  modality: string
  meetingUrl: string | null
  location: string | null
  classGroupName: string
  teacherName: string | null
  /** Aviso de ausencia ya cargado por el estudiante (si aplica). */
  noticedAbsenceAt: Date | null
  absenceNote: string | null
}

export type StudentUpcomingSession = {
  id: string
  scheduledStart: Date
  scheduledEnd: Date
  modality: string
  meetingUrl: string | null
  location: string | null
  classGroupId: string
  classGroupName: string
  teacherName: string | null
  status: "live" | "scheduled"
}

export type StudentRecentSession = {
  id: string
  scheduledStart: Date
  scheduledEnd: Date
  classGroupId: string
  classGroupName: string
  topic: string | null
  attendance: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "PENDING"
  sessionStatus: "COMPLETED" | "CANCELLED" | "NO_SHOW"
}

export type StudentHomework = {
  sessionId: string
  scheduledStart: Date
  classGroupId: string
  classGroupName: string
  topic: string
  homework: string
}

export type StudentAttendanceCounts = {
  present: number
  late: number
  absent: number
  excused: number
  /** Sesiones donde la asistencia ya fue registrada (no PENDING). */
  registered: number
}

export type StudentDashboard = {
  enrollments: StudentDashboardEnrollment[]
  nextClass: StudentNextClass | null
  // KPIs y agenda
  todaySessionCount: number
  weekSessionCount: number
  upcomingSessions: StudentUpcomingSession[]
  // Historial reciente
  recentSessions: StudentRecentSession[]
  // Tareas recientes
  recentHomework: StudentHomework[]
  // Asistencia
  attendance: StudentAttendanceCounts
}

export async function getStudentDashboard(userId: string): Promise<StudentDashboard> {
  const rows = await prisma.enrollment.findMany({
    where: { studentId: userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      modality: true,
      consumedHours: true,
      programLevelId: true,
      programLevel: {
        select: {
          name: true,
          totalHours: true,
          program: { select: { name: true } },
          materialFolders: {
            where: { parentId: null, deletedAt: null },
            select: { id: true },
            take: 1,
          },
        },
      },
      classGroup: {
        select: {
          id: true,
          name: true,
          slots: {
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
            select: { dayOfWeek: true, startTime: true },
          },
          teacherAssignments: {
            where: { endDate: null },
            orderBy: { startDate: "desc" },
            take: 1,
            select: {
              teacherId: true,
              teacher: {
                select: { user: { select: { firstName: true, lastName: true } } },
              },
            },
          },
        },
      },
    },
  })

  const enrollments: StudentDashboardEnrollment[] = rows.map((e) => ({
    enrollmentId: e.id,
    programLevelId: e.programLevelId,
    programName: e.programLevel.program.name,
    levelName: e.programLevel.name,
    modality: e.modality,
    rootFolderId: e.programLevel.materialFolders[0]?.id ?? null,
    consumedHours: Number(e.consumedHours),
    totalHours: Number(e.programLevel.totalHours),
    classGroup: e.classGroup
      ? {
          id: e.classGroup.id,
          name: e.classGroup.name,
          slots: e.classGroup.slots,
          currentTeacher: e.classGroup.teacherAssignments[0]
            ? {
                id: e.classGroup.teacherAssignments[0].teacherId,
                name: `${e.classGroup.teacherAssignments[0].teacher.user.firstName} ${e.classGroup.teacherAssignments[0].teacher.user.lastName}`,
              }
            : null,
        }
      : null,
  }))

  // Próxima sesión SCHEDULED del alumno (cualquier matrícula activa).
  const nextSessionRow = await prisma.classParticipant.findFirst({
    where: {
      enrollment: { studentId: userId, status: "ACTIVE" },
      session: {
        status: "SCHEDULED",
        scheduledEnd: { gte: new Date() },
      },
    },
    orderBy: { session: { scheduledStart: "asc" } },
    select: {
      noticedAbsenceAt: true,
      absenceNote: true,
      session: {
        select: {
          id: true,
          scheduledStart: true,
          scheduledEnd: true,
          modality: true,
          meetingUrl: true,
          location: true,
          classGroup: { select: { name: true } },
          teacher: {
            select: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
  })

  const nextClass: StudentNextClass | null = nextSessionRow
    ? {
        id: nextSessionRow.session.id,
        scheduledStart: nextSessionRow.session.scheduledStart,
        scheduledEnd: nextSessionRow.session.scheduledEnd,
        modality: nextSessionRow.session.modality,
        meetingUrl: nextSessionRow.session.meetingUrl,
        location: nextSessionRow.session.location,
        classGroupName: nextSessionRow.session.classGroup.name,
        teacherName: nextSessionRow.session.teacher
          ? `${nextSessionRow.session.teacher.user.firstName} ${nextSessionRow.session.teacher.user.lastName}`
          : null,
        noticedAbsenceAt: nextSessionRow.noticedAbsenceAt,
        absenceNote: nextSessionRow.absenceNote,
      }
    : null

  // ---------------------------------------------------------------------------
  //  Datos enriquecidos para el dashboard estilo admin/docente
  // ---------------------------------------------------------------------------

  const now = new Date()
  const todayStart = startOfGuayaquilDay(now)
  const todayEnd = new Date(todayStart.getTime() + 86_400_000)
  const weekEnd = new Date(todayStart.getTime() + 7 * 86_400_000)

  // Sesiones próximas (próximos 7 días, SCHEDULED) — para la agenda y el KPI
  // semanal. Cap a 8 entries.
  const upcomingRows = await prisma.classParticipant.findMany({
    where: {
      enrollment: { studentId: userId, status: "ACTIVE" },
      session: {
        status: "SCHEDULED",
        scheduledStart: { gte: todayStart, lt: weekEnd },
      },
    },
    orderBy: { session: { scheduledStart: "asc" } },
    take: 8,
    select: {
      session: {
        select: {
          id: true,
          scheduledStart: true,
          scheduledEnd: true,
          modality: true,
          meetingUrl: true,
          location: true,
          classGroupId: true,
          classGroup: { select: { name: true } },
          teacher: {
            select: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
  })

  const upcomingSessions: StudentUpcomingSession[] = upcomingRows.map((p) => {
    const s = p.session
    const isLive =
      s.scheduledStart.getTime() <= now.getTime() &&
      now.getTime() < s.scheduledEnd.getTime()
    return {
      id: s.id,
      scheduledStart: s.scheduledStart,
      scheduledEnd: s.scheduledEnd,
      modality: s.modality,
      meetingUrl: s.meetingUrl,
      location: s.location,
      classGroupId: s.classGroupId,
      classGroupName: s.classGroup.name,
      teacherName: s.teacher
        ? `${s.teacher.user.firstName} ${s.teacher.user.lastName}`
        : null,
      status: isLive ? "live" : "scheduled",
    }
  })

  const todaySessionCount = upcomingSessions.filter(
    (s) => s.scheduledStart < todayEnd,
  ).length

  // Conteo semanal — total de sesiones programadas en la ventana (no cap, no
  // se acota a 8 entries).
  const weekSessionCount = await prisma.classParticipant.count({
    where: {
      enrollment: { studentId: userId, status: "ACTIVE" },
      session: {
        status: { in: ["SCHEDULED", "COMPLETED"] },
        scheduledStart: { gte: todayStart, lt: weekEnd },
      },
    },
  })

  // Historial reciente — últimas 6 participaciones cerradas. Si la sesión es
  // CANCELLED no la incluimos (cancelación no es información útil acá).
  const recentRows = await prisma.classParticipant.findMany({
    where: {
      enrollment: { studentId: userId, status: "ACTIVE" },
      session: {
        status: { in: ["COMPLETED", "NO_SHOW"] },
      },
    },
    orderBy: { session: { scheduledStart: "desc" } },
    take: 6,
    select: {
      attendance: true,
      session: {
        select: {
          id: true,
          status: true,
          scheduledStart: true,
          scheduledEnd: true,
          classGroupId: true,
          classGroup: { select: { name: true } },
          log: { select: { topic: true } },
        },
      },
    },
  })

  const recentSessions: StudentRecentSession[] = recentRows.map((p) => ({
    id: p.session.id,
    scheduledStart: p.session.scheduledStart,
    scheduledEnd: p.session.scheduledEnd,
    classGroupId: p.session.classGroupId,
    classGroupName: p.session.classGroup.name,
    topic: p.session.log?.topic ?? null,
    attendance: p.attendance,
    sessionStatus: p.session.status as "COMPLETED" | "NO_SHOW",
  }))

  // Tareas recientes — bitácoras de sesiones cerradas con `homework` no-null
  // de las últimas 14 sesiones. Cap a 5.
  const homeworkRows = await prisma.classLog.findMany({
    where: {
      homework: { not: null },
      session: {
        status: "COMPLETED",
        participants: {
          some: { enrollment: { studentId: userId, status: "ACTIVE" } },
        },
      },
    },
    orderBy: { session: { scheduledStart: "desc" } },
    take: 5,
    select: {
      topic: true,
      homework: true,
      session: {
        select: {
          id: true,
          scheduledStart: true,
          classGroupId: true,
          classGroup: { select: { name: true } },
        },
      },
    },
  })

  const recentHomework: StudentHomework[] = homeworkRows
    .filter((l) => l.homework !== null && l.homework.trim().length > 0)
    .map((l) => ({
      sessionId: l.session.id,
      scheduledStart: l.session.scheduledStart,
      classGroupId: l.session.classGroupId,
      classGroupName: l.session.classGroup.name,
      topic: l.topic,
      // El filter de arriba garantiza non-null pero TS no lo infiere; assertion safe.
      homework: l.homework as string,
    }))

  // Resumen de asistencia — agregamos por status para todas las matrículas
  // del alumno.
  const attendanceGroups = await prisma.classParticipant.groupBy({
    by: ["attendance"],
    where: {
      enrollment: { studentId: userId },
    },
    _count: { _all: true },
  })

  const attendance: StudentAttendanceCounts = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    registered: 0,
  }
  for (const g of attendanceGroups) {
    if (g.attendance === "PRESENT") attendance.present = g._count._all
    else if (g.attendance === "LATE") attendance.late = g._count._all
    else if (g.attendance === "ABSENT") attendance.absent = g._count._all
    else if (g.attendance === "EXCUSED") attendance.excused = g._count._all
  }
  attendance.registered =
    attendance.present + attendance.late + attendance.absent + attendance.excused

  return {
    enrollments,
    nextClass,
    todaySessionCount,
    weekSessionCount,
    upcomingSessions,
    recentSessions,
    recentHomework,
    attendance,
  }
}

// -----------------------------------------------------------------------------
//  Progreso detallado — usado por /estudiante/progreso
// -----------------------------------------------------------------------------

export type StudentProgressEnrollment = {
  enrollmentId: string
  programName: string
  levelName: string
  cefrLevelCode: string | null
  modality: string
  consumedHours: number
  totalHours: number
  classDurationMinutes: number
  startedAt: Date
  /** Última sesión con asistencia registrada (no PENDING). */
  lastAttendedAt: Date | null
  /** Conteo de sesiones donde la asistencia ya fue marcada distinta de PENDING. */
  registeredCount: number
  attendedCount: number
  rootFolderId: string | null
  classGroup: {
    id: string
    name: string
    slots: { dayOfWeek: number; startTime: string; durationMinutes: number }[]
    currentTeacher: string | null
  } | null
}

export type StudentClosedEnrollment = {
  enrollmentId: string
  programName: string
  levelName: string
  cefrLevelCode: string | null
  status: EnrollmentStatus
  consumedHours: number
  totalHours: number
  startedAt: Date
  closedAt: Date | null
}

export type StudentProgressHistoryItem = {
  sessionId: string
  scheduledStart: Date
  scheduledEnd: Date
  durationMinutes: number
  classGroupId: string
  classGroupName: string
  topic: string | null
  homework: string | null
  attendance: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "PENDING"
  sessionStatus: "COMPLETED" | "NO_SHOW"
}

export type StudentProgress = {
  activeEnrollments: StudentProgressEnrollment[]
  closedEnrollments: StudentClosedEnrollment[]
  attendance: StudentAttendanceCounts
  /** Suma total de horas dictadas (snapshot de horas consumidas en todas las matrículas, activas y cerradas). */
  totalHoursDictated: number
  history: StudentProgressHistoryItem[]
}

const PROGRESS_HISTORY_LIMIT = 30

export async function getStudentProgress(
  userId: string,
): Promise<StudentProgress> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      programLevel: {
        include: {
          program: {
            select: {
              name: true,
              course: { select: { name: true, classDuration: true } },
            },
          },
          materialFolders: {
            where: { parentId: null, deletedAt: null },
            select: { id: true },
            take: 1,
          },
        },
      },
      classGroup: {
        select: {
          id: true,
          name: true,
          slots: {
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
            select: {
              dayOfWeek: true,
              startTime: true,
              durationMinutes: true,
            },
          },
          teacherAssignments: {
            where: { endDate: null },
            take: 1,
            select: {
              teacher: {
                select: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  const activeIds = enrollments
    .filter((e) => e.status === EnrollmentStatus.ACTIVE)
    .map((e) => e.id)

  // Última participación con asistencia ≠ PENDING + counts por matrícula activa
  type Tally = { attended: number; registered: number; lastAttendedAt: Date | null }
  const tallyMap = new Map<string, Tally>()

  if (activeIds.length > 0) {
    const participantRows = await prisma.classParticipant.findMany({
      where: {
        enrollmentId: { in: activeIds },
        attendance: { not: "PENDING" },
      },
      orderBy: { session: { scheduledStart: "desc" } },
      select: {
        enrollmentId: true,
        attendance: true,
        session: { select: { scheduledStart: true } },
      },
    })
    for (const p of participantRows) {
      const tally = tallyMap.get(p.enrollmentId) ?? {
        attended: 0,
        registered: 0,
        lastAttendedAt: null,
      }
      tally.registered += 1
      if (p.attendance === "PRESENT" || p.attendance === "LATE") {
        tally.attended += 1
      }
      if (
        tally.lastAttendedAt === null ||
        p.session.scheduledStart > tally.lastAttendedAt
      ) {
        tally.lastAttendedAt = p.session.scheduledStart
      }
      tallyMap.set(p.enrollmentId, tally)
    }
  }

  const activeEnrollments: StudentProgressEnrollment[] = enrollments
    .filter((e) => e.status === EnrollmentStatus.ACTIVE)
    .map((e) => {
      const tally = tallyMap.get(e.id) ?? {
        attended: 0,
        registered: 0,
        lastAttendedAt: null,
      }
      return {
        enrollmentId: e.id,
        programName: e.programLevel.program.name,
        levelName: e.programLevel.name,
        cefrLevelCode: e.programLevel.cefrLevelCode,
        modality: e.modality,
        consumedHours: Number(e.consumedHours),
        totalHours: Number(e.programLevel.totalHours),
        classDurationMinutes: e.programLevel.program.course.classDuration,
        startedAt: e.createdAt,
        lastAttendedAt: tally.lastAttendedAt,
        registeredCount: tally.registered,
        attendedCount: tally.attended,
        rootFolderId: e.programLevel.materialFolders[0]?.id ?? null,
        classGroup: e.classGroup
          ? {
              id: e.classGroup.id,
              name: e.classGroup.name,
              slots: e.classGroup.slots,
              currentTeacher: e.classGroup.teacherAssignments[0]
                ? `${e.classGroup.teacherAssignments[0].teacher.user.firstName} ${e.classGroup.teacherAssignments[0].teacher.user.lastName}`
                : null,
            }
          : null,
      }
    })

  const closedEnrollments: StudentClosedEnrollment[] = enrollments
    .filter((e) => e.status !== EnrollmentStatus.ACTIVE)
    .map((e) => ({
      enrollmentId: e.id,
      programName: e.programLevel.program.name,
      levelName: e.programLevel.name,
      cefrLevelCode: e.programLevel.cefrLevelCode,
      status: e.status,
      consumedHours: Number(e.consumedHours),
      totalHours: Number(e.programLevel.totalHours),
      startedAt: e.createdAt,
      closedAt: e.closedAt,
    }))

  // Asistencia total — agregamos por status sobre TODAS las matrículas del
  // alumno (activas e históricas). Espejo del dashboard pero acá lo dejamos
  // explícito porque la página es la "única fuente de verdad" para el alumno.
  const attendanceGroups = await prisma.classParticipant.groupBy({
    by: ["attendance"],
    where: { enrollment: { studentId: userId } },
    _count: { _all: true },
  })

  const attendance: StudentAttendanceCounts = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    registered: 0,
  }
  for (const g of attendanceGroups) {
    if (g.attendance === "PRESENT") attendance.present = g._count._all
    else if (g.attendance === "LATE") attendance.late = g._count._all
    else if (g.attendance === "ABSENT") attendance.absent = g._count._all
    else if (g.attendance === "EXCUSED") attendance.excused = g._count._all
  }
  attendance.registered =
    attendance.present + attendance.late + attendance.absent + attendance.excused

  const totalHoursDictated = enrollments.reduce(
    (acc, e) => acc + Number(e.consumedHours),
    0,
  )

  // Historial — últimas N sesiones cerradas o sin registro
  const historyRows = await prisma.classParticipant.findMany({
    where: {
      enrollment: { studentId: userId },
      session: { status: { in: ["COMPLETED", "NO_SHOW"] } },
    },
    orderBy: { session: { scheduledStart: "desc" } },
    take: PROGRESS_HISTORY_LIMIT,
    select: {
      attendance: true,
      session: {
        select: {
          id: true,
          status: true,
          scheduledStart: true,
          scheduledEnd: true,
          classGroupId: true,
          classGroup: { select: { name: true } },
          log: { select: { topic: true, homework: true } },
        },
      },
    },
  })

  const history: StudentProgressHistoryItem[] = historyRows.map((p) => ({
    sessionId: p.session.id,
    scheduledStart: p.session.scheduledStart,
    scheduledEnd: p.session.scheduledEnd,
    durationMinutes: Math.round(
      (p.session.scheduledEnd.getTime() - p.session.scheduledStart.getTime()) /
        60_000,
    ),
    classGroupId: p.session.classGroupId,
    classGroupName: p.session.classGroup.name,
    topic: p.session.log?.topic ?? null,
    homework: p.session.log?.homework ?? null,
    attendance: p.attendance,
    sessionStatus: p.session.status as "COMPLETED" | "NO_SHOW",
  }))

  return {
    activeEnrollments,
    closedEnrollments,
    attendance,
    totalHoursDictated,
    history,
  }
}

function startOfGuayaquilDay(now: Date): Date {
  const guayaquilOffsetMs = 5 * 60 * 60 * 1000
  const localMs = now.getTime() - guayaquilOffsetMs
  const local = new Date(localMs)
  const utcMidnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  )
  return new Date(utcMidnight + guayaquilOffsetMs)
}
