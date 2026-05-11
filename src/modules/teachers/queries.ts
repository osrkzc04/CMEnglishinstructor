import "server-only"
import { cache } from "react"
import { Prisma, UserStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { TeacherListFiltersSchema, type TeacherListFilters } from "./schemas"

/**
 * Lectura del módulo docentes para el panel admin.
 *
 * Trabajamos con `User where role = TEACHER` y la relación opcional con
 * `TeacherProfile`. El profile siempre debería existir si el usuario es
 * TEACHER (lo crea el alta o el approve de la postulación), pero toleramos
 * su ausencia para no romper si quedó un dato inconsistente.
 */

// -----------------------------------------------------------------------------
//  Listado paginado
// -----------------------------------------------------------------------------

export type TeacherListItem = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  document: string | null
  status: UserStatus
  isActive: boolean
  levelCount: number
  availabilityHours: number
  activeAssignments: number
}

export type TeacherListResult = {
  items: TeacherListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function listTeachers(raw: Partial<TeacherListFilters>): Promise<TeacherListResult> {
  const filters = TeacherListFiltersSchema.parse(raw)
  const where = buildWhere(filters)
  const today = startOfTodayUTC()

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: {
        teacherProfile: {
          include: {
            availability: true,
            _count: { select: { teachableLevels: true } },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  // Asignaciones vigentes por docente — una query separada con un groupBy es
  // lo más barato; meterlo como _count requiere filtros que el schema no
  // expone directamente.
  const teacherIds = users.map((u) => u.id)
  const activeByTeacher = new Map<string, number>()
  if (teacherIds.length > 0) {
    const groups = await prisma.teacherAssignment.groupBy({
      by: ["teacherId"],
      where: {
        teacherId: { in: teacherIds },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      _count: { _all: true },
    })
    for (const g of groups) {
      activeByTeacher.set(g.teacherId, g._count._all)
    }
  }

  return {
    items: users.map((u) => {
      const profile = u.teacherProfile
      const availabilityHours = profile
        ? profile.availability.reduce((acc, a) => acc + minutesBetween(a.startTime, a.endTime), 0) /
          60
        : 0
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        document: u.document,
        status: u.status,
        isActive: profile?.isActive ?? false,
        levelCount: profile?._count.teachableLevels ?? 0,
        availabilityHours,
        activeAssignments: activeByTeacher.get(u.id) ?? 0,
      }
    }),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  }
}

function buildWhere(filters: TeacherListFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { role: "TEACHER" }
  if (filters.status) where.status = filters.status
  if (filters.q) {
    where.OR = [
      { firstName: { contains: filters.q, mode: "insensitive" } },
      { lastName: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
      { document: { contains: filters.q, mode: "insensitive" } },
    ]
  }
  return where
}

// -----------------------------------------------------------------------------
//  Detalle (para forms inline)
// -----------------------------------------------------------------------------

export type TeacherAvailabilityRow = {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export type TeacherAssignmentRow = {
  id: string
  classGroupId: string
  classGroupName: string
  programLabel: string
  studentCount: number
  startDate: Date
  endDate: Date | null
  isCurrent: boolean
}

export type TeacherFullDetail = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  document: string | null
  status: UserStatus
  isActive: boolean
  createdAt: Date
  levelIds: string[]
  availability: TeacherAvailabilityRow[]
  assignments: TeacherAssignmentRow[]
}

export const getTeacherFullDetail = cache(async (id: string): Promise<TeacherFullDetail | null> => {
  const today = startOfTodayUTC()
  const row = await prisma.user.findFirst({
    where: { id, role: "TEACHER" },
    include: {
      teacherProfile: {
        include: {
          teachableLevels: true,
          availability: {
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
          },
          teacherAssignments: {
            orderBy: { startDate: "desc" },
            include: {
              classGroup: {
                include: {
                  programLevel: {
                    include: {
                      program: { include: { course: true } },
                    },
                  },
                  _count: { select: { enrollments: true } },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!row || !row.teacherProfile) return null

  const profile = row.teacherProfile
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    document: row.document,
    status: row.status,
    isActive: profile.isActive,
    createdAt: row.createdAt,
    levelIds: profile.teachableLevels.map((tl) => tl.levelId),
    availability: profile.availability.map((a) => ({
      id: a.id,
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
    })),
    assignments: profile.teacherAssignments.map((a) => {
      const g = a.classGroup
      const isCurrent = a.startDate <= today && (a.endDate === null || a.endDate >= today)
      return {
        id: a.id,
        classGroupId: g.id,
        classGroupName: g.name,
        programLabel: `${g.programLevel.program.course.name} · ${g.programLevel.program.name} · ${g.programLevel.name}`,
        studentCount: g._count.enrollments,
        startDate: a.startDate,
        endDate: a.endDate,
        isCurrent,
      }
    }),
  }
})

// -----------------------------------------------------------------------------
//  KPIs
// -----------------------------------------------------------------------------

export type TeacherStats = {
  total: number
  active: number
  inactive: number
  pendingApplications: number
  withActiveAssignments: number
}

export const getTeacherStats = cache(async (): Promise<TeacherStats> => {
  const today = startOfTodayUTC()
  const [total, active, inactive, pendingApplications, withAssignmentsRows] =
    await prisma.$transaction([
      prisma.user.count({ where: { role: "TEACHER" } }),
      prisma.user.count({ where: { role: "TEACHER", status: "ACTIVE" } }),
      prisma.user.count({ where: { role: "TEACHER", status: "INACTIVE" } }),
      prisma.teacherApplication.count({ where: { status: "PENDING" } }),
      prisma.teacherAssignment.findMany({
        where: { OR: [{ endDate: null }, { endDate: { gte: today } }] },
        select: { teacherId: true },
        distinct: ["teacherId"],
      }),
    ])
  return {
    total,
    active,
    inactive,
    pendingApplications,
    withActiveAssignments: withAssignmentsRows.length,
  }
})

// -----------------------------------------------------------------------------
//  Catálogo de niveles CEFR — opciones del multiselect del form de niveles.
//  Devuelve niveles agrupados por idioma para el UI los pueda renderizar en
//  secciones (Inglés, Español).
// -----------------------------------------------------------------------------

export type CefrLevelOption = {
  id: string
  code: string
  name: string
  order: number
}

export type CefrLanguageGroup = {
  languageId: string
  languageName: string
  languageCode: string
  levels: CefrLevelOption[]
}

export const listCefrLevelsByLanguage = cache(async (): Promise<CefrLanguageGroup[]> => {
  const languages = await prisma.language.findMany({
    orderBy: { name: "asc" },
    include: {
      cefrLevels: { orderBy: { order: "asc" } },
    },
  })
  return languages.map((lang) => ({
    languageId: lang.id,
    languageName: lang.name,
    languageCode: lang.code,
    levels: lang.cefrLevels.map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      order: l.order,
    })),
  }))
})

// -----------------------------------------------------------------------------
//  Helpers
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
//  Dashboard del docente
// -----------------------------------------------------------------------------

export type TeacherDashboardClassGroup = {
  id: string
  name: string
  programLabel: string
  levelName: string
  modality: string
  studentCount: number
  slots: { dayOfWeek: number; startTime: string }[]
  /**
   * Horas totales del nivel del aula. Mismo número para todas las matrículas
   * porque la regla de no-mezclar-niveles garantiza que comparten programLevel.
   */
  totalHours: number
  /**
   * Promedio de `Enrollment.consumedHours` de los alumnos activos del aula.
   * Si no hay alumnos, 0. Sirve para mostrar "el grupo está en hora X de Y".
   */
  avgConsumedHours: number
}

export type TeacherDashboardLevel = {
  programLevelId: string
  programName: string
  levelName: string
  rootFolderId: string | null
}

export type TeacherNextClass = {
  id: string
  scheduledStart: Date
  scheduledEnd: Date
  modality: string
  meetingUrl: string | null
  location: string | null
  classGroupName: string
  participantCount: number
}

export type TeacherTodaySession = {
  id: string
  scheduledStart: Date
  scheduledEnd: Date
  classGroupId: string
  classGroupName: string
  programLabel: string
  modality: string
  meetingUrl: string | null
  location: string | null
  participantCount: number
  status: "live" | "scheduled" | "completed" | "cancelled" | "no_show"
}

export type TeacherActivityItem = {
  id: string
  kind: "completed" | "cancelled" | "no_show" | "enrollment"
  at: Date
  classGroupId: string | null
  classGroupName: string | null
  detail: string
}

export type TeacherPendingItem = {
  id: string
  scheduledStart: Date
  scheduledEnd: Date
  classGroupId: string
  classGroupName: string
  programLabel: string
  /**
   *  live     → ya empezó y aún no termina
   *  overdue  → pasó scheduledEnd y sigue SCHEDULED
   *  missing  → tiene PENDING attendance o le falta bitácora aunque siga en horario
   */
  reason: "live" | "overdue" | "missing"
}

export type TeacherLevelDistribution = {
  id: string
  programLevelId: string
  programName: string
  levelName: string
  cefrLevelCode: string | null
  count: number
}

export type TeacherDashboard = {
  isActiveTeacher: boolean
  classGroups: TeacherDashboardClassGroup[]
  studentCount: number
  levels: TeacherDashboardLevel[]
  nextClass: TeacherNextClass | null
  // KPIs
  classGroupCount: number
  todaySessionCount: number
  weekSessionCount: number
  pendingCount: number
  // Cards del nuevo layout
  todaySessions: TeacherTodaySession[]
  recentActivity: TeacherActivityItem[]
  pendings: TeacherPendingItem[]
  levelDistribution: TeacherLevelDistribution[]
}

export async function getTeacherDashboard(userId: string): Promise<TeacherDashboard> {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: { isActive: true },
  })

  if (!profile) {
    return {
      isActiveTeacher: false,
      classGroups: [],
      studentCount: 0,
      levels: [],
      nextClass: null,
      classGroupCount: 0,
      todaySessionCount: 0,
      weekSessionCount: 0,
      pendingCount: 0,
      todaySessions: [],
      recentActivity: [],
      pendings: [],
      levelDistribution: [],
    }
  }

  // Aulas vigentes — el docente "vigente" en un aula es el de TeacherAssignment
  // sin endDate. El aula además debe estar ACTIVE; si pasó a COMPLETED/CANCELLED
  // ya no la mostramos en el panel del día.
  const assignments = await prisma.teacherAssignment.findMany({
    where: {
      teacherId: userId,
      endDate: null,
      classGroup: { status: "ACTIVE" },
    },
    select: {
      classGroup: {
        select: {
          id: true,
          name: true,
          modality: true,
          programLevelId: true,
          programLevel: {
            select: {
              name: true,
              totalHours: true,
              program: { select: { name: true, course: { select: { name: true } } } },
            },
          },
          slots: {
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
            select: { dayOfWeek: true, startTime: true },
          },
          enrollments: {
            where: { status: "ACTIVE" },
            select: { consumedHours: true },
          },
        },
      },
    },
  })

  const classGroups: TeacherDashboardClassGroup[] = assignments.map((a) => {
    const g = a.classGroup
    const consumedSum = g.enrollments.reduce((acc, e) => acc + Number(e.consumedHours), 0)
    const studentCount = g.enrollments.length
    return {
      id: g.id,
      name: g.name,
      programLabel: `${g.programLevel.program.course.name} · ${g.programLevel.program.name}`,
      levelName: g.programLevel.name,
      modality: g.modality,
      studentCount,
      slots: g.slots,
      totalHours: Number(g.programLevel.totalHours),
      avgConsumedHours: studentCount > 0 ? consumedSum / studentCount : 0,
    }
  })

  const studentCount = classGroups.reduce((acc, g) => acc + g.studentCount, 0)

  // Niveles únicos derivados de las aulas vigentes — alimentan el card de
  // accesos rápidos a materiales. Se incluye la raíz del repositorio si existe.
  const levelIds = Array.from(new Set(assignments.map((a) => a.classGroup.programLevelId)))
  const levelsRaw = await prisma.programLevel.findMany({
    where: { id: { in: levelIds } },
    select: {
      id: true,
      name: true,
      program: { select: { name: true } },
      materialFolders: {
        where: { parentId: null, deletedAt: null },
        select: { id: true },
        take: 1,
      },
    },
  })

  const levels: TeacherDashboardLevel[] = levelsRaw.map((l) => ({
    programLevelId: l.id,
    programName: l.program.name,
    levelName: l.name,
    rootFolderId: l.materialFolders[0]?.id ?? null,
  }))

  // Próxima sesión SCHEDULED del docente — toma cualquier aula de la que sea
  // el docente vigente. Si ya pasó scheduledEnd, no la mostramos como
  // "próxima" — el job de auto-cierre la cerrará y aparecerá en otra parte.
  const nextSession = await prisma.classSession.findFirst({
    where: {
      teacherId: userId,
      status: "SCHEDULED",
      scheduledEnd: { gte: new Date() },
    },
    orderBy: { scheduledStart: "asc" },
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      modality: true,
      meetingUrl: true,
      location: true,
      classGroup: { select: { name: true } },
      _count: { select: { participants: true } },
    },
  })

  const nextClass: TeacherNextClass | null = nextSession
    ? {
        id: nextSession.id,
        scheduledStart: nextSession.scheduledStart,
        scheduledEnd: nextSession.scheduledEnd,
        modality: nextSession.modality,
        meetingUrl: nextSession.meetingUrl,
        location: nextSession.location,
        classGroupName: nextSession.classGroup.name,
        participantCount: nextSession._count.participants,
      }
    : null

  // ---------------------------------------------------------------------------
  //  Datos para el dashboard estilo admin
  // ---------------------------------------------------------------------------

  const now = new Date()
  const todayStartGuayaquil = startOfGuayaquilDay(now)
  const todayEndGuayaquil = new Date(todayStartGuayaquil.getTime() + 24 * 60 * 60 * 1000)
  const weekEnd = new Date(todayStartGuayaquil.getTime() + 7 * 86_400_000)

  // Sesiones de hoy (Guayaquil) — todas, sin filtro de status: queremos ver
  // las completadas y la en curso también en el listado.
  const todayRows = await prisma.classSession.findMany({
    where: {
      teacherId: userId,
      scheduledStart: { gte: todayStartGuayaquil, lt: todayEndGuayaquil },
    },
    orderBy: { scheduledStart: "asc" },
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      modality: true,
      meetingUrl: true,
      location: true,
      status: true,
      classGroupId: true,
      classGroup: {
        select: {
          name: true,
          programLevel: {
            select: {
              name: true,
              program: {
                select: {
                  name: true,
                  course: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      _count: { select: { participants: true } },
    },
  })

  const todaySessions: TeacherTodaySession[] = todayRows.map((s) => {
    const isLive =
      s.status === "SCHEDULED" &&
      s.scheduledStart.getTime() <= now.getTime() &&
      now.getTime() < s.scheduledEnd.getTime()
    const liftedStatus: TeacherTodaySession["status"] =
      s.status === "COMPLETED"
        ? "completed"
        : s.status === "CANCELLED"
          ? "cancelled"
          : s.status === "NO_SHOW"
            ? "no_show"
            : isLive
              ? "live"
              : "scheduled"
    return {
      id: s.id,
      scheduledStart: s.scheduledStart,
      scheduledEnd: s.scheduledEnd,
      classGroupId: s.classGroupId,
      classGroupName: s.classGroup.name,
      programLabel: `${s.classGroup.programLevel.program.course.name} · ${s.classGroup.programLevel.program.name} · ${s.classGroup.programLevel.name}`,
      modality: s.modality,
      meetingUrl: s.meetingUrl,
      location: s.location,
      participantCount: s._count.participants,
      status: liftedStatus,
    }
  })

  // Conteo semanal (próximas 7 días) — incluye hoy.
  const weekSessionCount = await prisma.classSession.count({
    where: {
      teacherId: userId,
      scheduledStart: { gte: todayStartGuayaquil, lt: weekEnd },
      status: { in: ["SCHEDULED", "COMPLETED"] },
    },
  })

  // Pendientes — sesiones que requieren atención:
  //   * live      → en curso (en su ventana)
  //   * overdue   → pasó el horario y sigue SCHEDULED
  //   * missing   → SCHEDULED hoy pero ya algo falta (bitácora o asistencia)
  //
  // El job de auto-cierre cierra "overdue" >5min después de scheduledEnd, así
  // que la lista naturalmente se vacía sola.
  const pendingRows = await prisma.classSession.findMany({
    where: {
      teacherId: userId,
      status: "SCHEDULED",
      scheduledEnd: { lt: weekEnd },
    },
    orderBy: { scheduledStart: "asc" },
    take: 10,
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      classGroupId: true,
      classGroup: {
        select: {
          name: true,
          programLevel: {
            select: {
              name: true,
              program: {
                select: {
                  name: true,
                  course: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      log: { select: { id: true } },
      participants: { select: { attendance: true }, take: 50 },
    },
  })

  const pendings: TeacherPendingItem[] = pendingRows
    .map<TeacherPendingItem | null>((s) => {
      const inRange =
        s.scheduledStart.getTime() <= now.getTime() && now.getTime() < s.scheduledEnd.getTime()
      const isOverdue = s.scheduledEnd.getTime() <= now.getTime()
      const hasPendingAttendance = s.participants.some((p) => p.attendance === "PENDING")
      const hasNoLog = s.log === null
      const reason: TeacherPendingItem["reason"] | null = isOverdue
        ? "overdue"
        : inRange
          ? "live"
          : hasNoLog || hasPendingAttendance
            ? "missing"
            : null
      if (!reason) return null
      return {
        id: s.id,
        scheduledStart: s.scheduledStart,
        scheduledEnd: s.scheduledEnd,
        classGroupId: s.classGroupId,
        classGroupName: s.classGroup.name,
        programLabel: `${s.classGroup.programLevel.program.course.name} · ${s.classGroup.programLevel.program.name} · ${s.classGroup.programLevel.name}`,
        reason,
      }
    })
    .filter((p): p is TeacherPendingItem => p !== null)

  // Actividad reciente — últimas sesiones cerradas o auto-cerradas + últimas
  // matrículas que entraron a sus aulas. Limitamos a 6 items combinados.
  //
  // `ClassSession` no tiene `updatedAt`, así que para "cuándo pasó" usamos
  // `actualEnd ?? cancelledAt ?? scheduledEnd` — orden de la consulta es por
  // `scheduledEnd` (proxy razonable: las sesiones recientemente terminadas
  // suelen ser las más relevantes).
  const recentSessions = await prisma.classSession.findMany({
    where: {
      teacherId: userId,
      status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] },
    },
    orderBy: { scheduledEnd: "desc" },
    take: 6,
    select: {
      id: true,
      status: true,
      actualEnd: true,
      cancelledAt: true,
      scheduledEnd: true,
      classGroupId: true,
      classGroup: { select: { name: true } },
      _count: { select: { participants: true } },
    },
  })

  const recentEnrollments = await prisma.enrollment.findMany({
    where: {
      classGroup: {
        teacherAssignments: { some: { teacherId: userId, endDate: null } },
      },
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: {
      id: true,
      createdAt: true,
      classGroupId: true,
      classGroup: { select: { name: true } },
      student: {
        select: { user: { select: { firstName: true, lastName: true } } },
      },
    },
  })

  const activitySessions: TeacherActivityItem[] = recentSessions.map((s) => {
    const kind =
      s.status === "COMPLETED" ? "completed" : s.status === "CANCELLED" ? "cancelled" : "no_show"
    const detail =
      kind === "completed"
        ? `Cerraste la clase · ${s._count.participants} ${s._count.participants === 1 ? "alumno" : "alumnos"}`
        : kind === "cancelled"
          ? "Sesión cancelada"
          : "Auto-cierre · clase sin registro"
    return {
      id: `s_${s.id}`,
      kind,
      at: s.actualEnd ?? s.cancelledAt ?? s.scheduledEnd,
      classGroupId: s.classGroupId,
      classGroupName: s.classGroup.name,
      detail,
    }
  })

  const activityEnrollments: TeacherActivityItem[] = recentEnrollments.map((e) => ({
    id: `e_${e.id}`,
    kind: "enrollment",
    at: e.createdAt,
    classGroupId: e.classGroupId,
    classGroupName: e.classGroup?.name ?? null,
    detail: `Nuevo alumno · ${e.student.user.firstName} ${e.student.user.lastName}`,
  }))

  const recentActivity: TeacherActivityItem[] = [...activitySessions, ...activityEnrollments]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6)

  // Distribución por nivel/programa — agrupamos los enrollments activos por
  // ProgramLevel. Útil para entender qué niveles enseña hoy.
  const levelGroups = await prisma.enrollment.groupBy({
    by: ["programLevelId"],
    where: {
      status: "ACTIVE",
      classGroup: {
        teacherAssignments: { some: { teacherId: userId, endDate: null } },
      },
    },
    _count: { _all: true },
  })

  const levelDistribution: TeacherLevelDistribution[] = await (async () => {
    if (levelGroups.length === 0) return []
    const ids = levelGroups.map((g) => g.programLevelId)
    const levelsRich = await prisma.programLevel.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        cefrLevelCode: true,
        program: { select: { name: true } },
      },
    })
    const map = new Map(levelsRich.map((l) => [l.id, l]))
    return levelGroups
      .map<TeacherLevelDistribution | null>((g) => {
        const lvl = map.get(g.programLevelId)
        if (!lvl) return null
        return {
          id: g.programLevelId,
          programLevelId: g.programLevelId,
          programName: lvl.program.name,
          levelName: lvl.name,
          cefrLevelCode: lvl.cefrLevelCode,
          count: g._count._all,
        }
      })
      .filter((x): x is TeacherLevelDistribution => x !== null)
      .sort((a, b) => b.count - a.count)
  })()

  return {
    isActiveTeacher: profile.isActive,
    classGroups,
    studentCount,
    levels,
    nextClass,
    classGroupCount: classGroups.length,
    todaySessionCount: todaySessions.length,
    weekSessionCount,
    pendingCount: pendings.length,
    todaySessions,
    recentActivity,
    pendings,
    levelDistribution,
  }
}

// -----------------------------------------------------------------------------
//  Mis estudiantes — usados por /docente/estudiantes
// -----------------------------------------------------------------------------

export type TeacherStudentRow = {
  enrollmentId: string
  studentId: string
  studentName: string
  studentEmail: string
  studentPhone: string | null
  programLabel: string
  levelName: string
  modality: string
  consumedHours: number
  totalHours: number
  /** N sesiones con asistencia ≠ PENDING (i.e. ya registradas). */
  registeredCount: number
  /** Total de participaciones (incluye PENDING — futuras o sin marcar). */
  totalCount: number
  /** PRESENT + LATE. */
  attendedCount: number
  absentCount: number
  excusedCount: number
  classGroup: {
    id: string
    name: string
  }
  joinedAt: Date
}

export type TeacherStudentsResult = {
  rows: TeacherStudentRow[]
  classGroups: { id: string; name: string }[]
}

export async function listTeacherStudents(
  teacherId: string,
  opts: { classGroupId?: string } = {},
): Promise<TeacherStudentsResult> {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: "ACTIVE",
      classGroup: {
        teacherAssignments: { some: { teacherId, endDate: null } },
        ...(opts.classGroupId ? { id: opts.classGroupId } : {}),
      },
    },
    orderBy: [{ classGroup: { name: "asc" } }, { student: { user: { firstName: "asc" } } }],
    include: {
      student: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      classGroup: {
        select: { id: true, name: true },
      },
      programLevel: {
        select: {
          name: true,
          totalHours: true,
          program: {
            select: {
              name: true,
              course: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  // Conteo de asistencias por enrollment — un solo groupBy a `ClassParticipant`
  // y luego mapeamos. Filtramos por enrollmentIds para no traer del resto del
  // sistema.
  const enrollmentIds = enrollments.map((e) => e.id)
  const attendanceGroups =
    enrollmentIds.length > 0
      ? await prisma.classParticipant.groupBy({
          by: ["enrollmentId", "attendance"],
          where: { enrollmentId: { in: enrollmentIds } },
          _count: { _all: true },
        })
      : []

  // Indexamos: enrollmentId → { PRESENT, LATE, ABSENT, EXCUSED, PENDING }
  type AttendanceTally = {
    present: number
    late: number
    absent: number
    excused: number
    pending: number
  }
  const tallyMap = new Map<string, AttendanceTally>()
  for (const g of attendanceGroups) {
    const tally = tallyMap.get(g.enrollmentId) ?? {
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      pending: 0,
    }
    if (g.attendance === "PRESENT") tally.present = g._count._all
    else if (g.attendance === "LATE") tally.late = g._count._all
    else if (g.attendance === "ABSENT") tally.absent = g._count._all
    else if (g.attendance === "EXCUSED") tally.excused = g._count._all
    else tally.pending = g._count._all
    tallyMap.set(g.enrollmentId, tally)
  }

  const rows: TeacherStudentRow[] = enrollments
    .filter((e) => e.classGroup !== null)
    .map((e) => {
      const tally = tallyMap.get(e.id) ?? {
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        pending: 0,
      }
      const attendedCount = tally.present + tally.late
      const registeredCount = tally.present + tally.late + tally.absent + tally.excused
      const totalCount = registeredCount + tally.pending
      // El filtro de arriba garantiza que classGroup no es null; el `!` evita
      // que TS lo trate como opcional dentro del map.
      const group = e.classGroup!
      return {
        enrollmentId: e.id,
        studentId: e.studentId,
        studentName: `${e.student.user.firstName} ${e.student.user.lastName}`,
        studentEmail: e.student.user.email,
        studentPhone: e.student.user.phone,
        programLabel: `${e.programLevel.program.course.name} · ${e.programLevel.program.name}`,
        levelName: e.programLevel.name,
        modality: e.modality,
        consumedHours: Number(e.consumedHours),
        totalHours: Number(e.programLevel.totalHours),
        registeredCount,
        totalCount,
        attendedCount,
        absentCount: tally.absent,
        excusedCount: tally.excused,
        classGroup: {
          id: group.id,
          name: group.name,
        },
        joinedAt: e.createdAt,
      }
    })

  const classGroups = await prisma.classGroup.findMany({
    where: {
      teacherAssignments: { some: { teacherId, endDate: null } },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })

  return { rows, classGroups }
}

// -----------------------------------------------------------------------------
//  Bitácoras — usadas por /docente/bitacoras
// -----------------------------------------------------------------------------

export type TeacherBitacoraPending = {
  sessionId: string
  scheduledStart: Date
  scheduledEnd: Date
  classGroupId: string
  classGroupName: string
  programLabel: string
}

export type TeacherBitacoraEntry = {
  sessionId: string
  scheduledStart: Date
  scheduledEnd: Date
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
  classGroupId: string
  classGroupName: string
  programLabel: string
  topic: string
  activities: string
  homework: string | null
  materialsUsed: string | null
  updatedAt: Date
}

export type TeacherBitacorasResult = {
  pendings: TeacherBitacoraPending[]
  entries: TeacherBitacoraEntry[]
  /** Aulas del docente para alimentar el filtro. */
  classGroups: { id: string; name: string }[]
  /** Total cargado en historial (para meta del header — entries cap a 50). */
  entriesTotal: number
}

const BITACORA_ENTRIES_LIMIT = 50

export async function listTeacherBitacoras(
  teacherId: string,
  opts: { classGroupId?: string } = {},
): Promise<TeacherBitacorasResult> {
  const now = new Date()

  // Pendientes: sesiones SCHEDULED cuyo scheduledStart ya pasó y aún no tienen
  // bitácora cargada. Las muestra por horario inverso (más reciente arriba) —
  // suelen ser las que el docente tiene en mente.
  const pendingsRaw = await prisma.classSession.findMany({
    where: {
      teacherId,
      status: "SCHEDULED",
      scheduledStart: { lt: now },
      log: { is: null },
      ...(opts.classGroupId ? { classGroupId: opts.classGroupId } : {}),
    },
    orderBy: { scheduledStart: "desc" },
    take: 20,
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      classGroupId: true,
      classGroup: {
        select: {
          name: true,
          programLevel: {
            select: {
              name: true,
              program: {
                select: {
                  name: true,
                  course: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  const pendings: TeacherBitacoraPending[] = pendingsRaw.map((s) => ({
    sessionId: s.id,
    scheduledStart: s.scheduledStart,
    scheduledEnd: s.scheduledEnd,
    classGroupId: s.classGroupId,
    classGroupName: s.classGroup.name,
    programLabel: `${s.classGroup.programLevel.program.course.name} · ${s.classGroup.programLevel.program.name} · ${s.classGroup.programLevel.name}`,
  }))

  // Historial: bitácoras existentes — del docente, ordenadas por updatedAt
  // descendente. Cap a 50 entries para no traer histórico infinito; agregamos
  // paginación si llega a ser necesario.
  const [entriesRaw, entriesTotal] = await prisma.$transaction([
    prisma.classLog.findMany({
      where: {
        session: {
          teacherId,
          ...(opts.classGroupId ? { classGroupId: opts.classGroupId } : {}),
        },
      },
      orderBy: { updatedAt: "desc" },
      take: BITACORA_ENTRIES_LIMIT,
      select: {
        topic: true,
        activities: true,
        homework: true,
        materialsUsed: true,
        updatedAt: true,
        session: {
          select: {
            id: true,
            scheduledStart: true,
            scheduledEnd: true,
            status: true,
            classGroupId: true,
            classGroup: {
              select: {
                name: true,
                programLevel: {
                  select: {
                    name: true,
                    program: {
                      select: {
                        name: true,
                        course: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.classLog.count({
      where: {
        session: {
          teacherId,
          ...(opts.classGroupId ? { classGroupId: opts.classGroupId } : {}),
        },
      },
    }),
  ])

  const entries: TeacherBitacoraEntry[] = entriesRaw.map((l) => ({
    sessionId: l.session.id,
    scheduledStart: l.session.scheduledStart,
    scheduledEnd: l.session.scheduledEnd,
    status: l.session.status,
    classGroupId: l.session.classGroupId,
    classGroupName: l.session.classGroup.name,
    programLabel: `${l.session.classGroup.programLevel.program.course.name} · ${l.session.classGroup.programLevel.program.name} · ${l.session.classGroup.programLevel.name}`,
    topic: l.topic,
    activities: l.activities,
    homework: l.homework,
    materialsUsed: l.materialsUsed,
    updatedAt: l.updatedAt,
  }))

  // Aulas vigentes del docente — para el filtro del header.
  const classGroupRows = await prisma.classGroup.findMany({
    where: {
      teacherAssignments: { some: { teacherId, endDate: null } },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })

  return {
    pendings,
    entries,
    classGroups: classGroupRows,
    entriesTotal,
  }
}

// -----------------------------------------------------------------------------
//  Agenda semanal — usada por /docente/agenda
// -----------------------------------------------------------------------------

export type TeacherWeekSession = {
  id: string
  scheduledStart: Date
  scheduledEnd: Date
  classGroupId: string
  classGroupName: string
  modality: string
  meetingUrl: string | null
  location: string | null
  participantCount: number
  status: "live" | "scheduled" | "completed" | "cancelled" | "no_show"
}

export async function listTeacherWeekAgenda(
  teacherId: string,
  weekStart: Date,
): Promise<TeacherWeekSession[]> {
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000)
  const now = new Date()

  const rows = await prisma.classSession.findMany({
    where: {
      teacherId,
      scheduledStart: { gte: weekStart, lt: weekEnd },
    },
    orderBy: { scheduledStart: "asc" },
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      status: true,
      modality: true,
      meetingUrl: true,
      location: true,
      classGroupId: true,
      classGroup: { select: { name: true } },
      _count: { select: { participants: true } },
    },
  })

  return rows.map((s) => {
    const isLive =
      s.status === "SCHEDULED" &&
      s.scheduledStart.getTime() <= now.getTime() &&
      now.getTime() < s.scheduledEnd.getTime()
    const status: TeacherWeekSession["status"] =
      s.status === "COMPLETED"
        ? "completed"
        : s.status === "CANCELLED"
          ? "cancelled"
          : s.status === "NO_SHOW"
            ? "no_show"
            : isLive
              ? "live"
              : "scheduled"
    return {
      id: s.id,
      scheduledStart: s.scheduledStart,
      scheduledEnd: s.scheduledEnd,
      classGroupId: s.classGroupId,
      classGroupName: s.classGroup.name,
      modality: s.modality,
      meetingUrl: s.meetingUrl,
      location: s.location,
      participantCount: s._count.participants,
      status,
    }
  })
}

/**
 * Inicio del día actual en zona horaria Guayaquil (UTC-5), expresado en UTC.
 */
function startOfGuayaquilDay(now: Date): Date {
  const guayaquilOffsetMs = 5 * 60 * 60 * 1000
  const localMs = now.getTime() - guayaquilOffsetMs
  const local = new Date(localMs)
  const utcMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  return new Date(utcMidnight + guayaquilOffsetMs)
}

/**
 * Carga la disponibilidad semanal en aislamiento — usado por la página de
 * autoservicio del docente para no traer el resto del perfil.
 */
export async function getTeacherAvailabilityBlocks(
  userId: string,
): Promise<{ dayOfWeek: number; startTime: string; endTime: string }[]> {
  const rows = await prisma.teacherAvailability.findMany({
    where: { teacherId: userId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    select: { dayOfWeek: true, startTime: true, endTime: true },
  })
  return rows
}

function startOfTodayUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function minutesBetween(start: string, end: string): number {
  const s = start.split(":")
  const e = end.split(":")
  const sh = Number(s[0] ?? 0)
  const sm = Number(s[1] ?? 0)
  const eh = Number(e[0] ?? 0)
  const em = Number(e[1] ?? 0)
  return eh * 60 + em - (sh * 60 + sm)
}
