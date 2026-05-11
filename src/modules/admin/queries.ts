import "server-only"
import {
  ApplicationStatus,
  ClassGroupStatus,
  EnrollmentStatus,
  SessionStatus,
  UserStatus,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Datos del dashboard del administrador.
 *
 * No hay un audit-log poblado todavía, así que la "actividad reciente" se
 * deriva de eventos sobre tablas existentes: postulaciones nuevas, sesiones
 * cerradas o canceladas, pruebas de nivel enviadas y nuevas matrículas.
 *
 * Toda fecha se devuelve como `Date` en UTC; el formateo a Guayaquil lo hace
 * la página.
 */

const ACTIVITY_LIMIT = 6
const AGENDA_LIMIT = 8
const PENDINGS_LIMIT = 5
const TEACHER_LOAD_LIMIT = 6
const WEEKLY_CAPACITY_HOURS_DEFAULT = 25

// =============================================================================
//  Tipos
// =============================================================================

export type AdminDashboardKpis = {
  activeStudents: number
  todaySessions: {
    total: number
    live: number
    completed: number
    cancelled: number
    scheduled: number
  }
  pendingApplications: number
  /** Promedio de utilización (asignado / capacidad) entre docentes activos. */
  teacherUtilizationPct: number | null
  /** Total de matrículas activas — útil para meta del LevelsCard. */
  activeEnrollments: number
}

export type AdminAgendaEntry = {
  id: string
  scheduledStart: Date
  scheduledEnd: Date
  classGroupId: string
  /** Nombre principal de la fila: estudiante (1-a-1) o aula. */
  primaryLabel: string
  /** Subtítulo (programa · CEFR · modalidad). */
  programLabel: string
  cefrLevelCode: string | null
  modality: string
  teacherInitials: string
  teacherName: string
  status: "live" | "scheduled" | "completed" | "cancelled" | "no_show"
  participantCount: number
}

export type AdminActivityItem = {
  id: string
  kind:
    | "application_new"
    | "application_approved"
    | "application_rejected"
    | "enrollment_new"
    | "session_completed"
    | "session_cancelled"
    | "session_no_show"
    | "test_submitted"
  at: Date
  /** Cuerpo principal del item. */
  primary: string
  /** Texto secundario opcional (programa, aula, etc.). */
  secondary: string | null
  /** Link sugerido para el item (puede ser null). */
  href: string | null
}

export type AdminPendingApplication = {
  id: string
  fullName: string
  initials: string
  email: string
  levelsLabel: string
  createdAt: Date
}

export type AdminTeacherLoad = {
  id: string
  fullName: string
  initials: string
  cefrLabel: string
  /** Horas semanales asignadas (sum de slots × durationMinutes / 60). */
  hours: number
  /** Capacidad semanal en horas según disponibilidad cargada. */
  capacity: number
}

export type AdminLevelDistribution = {
  id: "basico" | "intermedio" | "avanzado" | "sin"
  name: string
  tag: string
  count: number
  total: number
}

export type AdminDashboard = {
  kpis: AdminDashboardKpis
  agenda: AdminAgendaEntry[]
  totalTeachersToday: number
  recentActivity: AdminActivityItem[]
  pendingApplications: AdminPendingApplication[]
  teacherLoad: AdminTeacherLoad[]
  activeTeachersCount: number
  levels: AdminLevelDistribution[]
}

// =============================================================================
//  Query principal
// =============================================================================

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const now = new Date()
  const todayStart = startOfGuayaquilDay(now)
  const todayEnd = new Date(todayStart.getTime() + 86_400_000)
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)

  // ---------------------------------------------------------------------------
  //  KPIs base — counts simples
  // ---------------------------------------------------------------------------
  const [
    activeStudents,
    pendingApplications,
    activeEnrollments,
    todaySessionRows,
  ] = await Promise.all([
    prisma.user.count({
      where: { role: "STUDENT", status: UserStatus.ACTIVE },
    }),
    prisma.teacherApplication.count({
      where: { status: ApplicationStatus.PENDING },
    }),
    prisma.enrollment.count({
      where: { status: EnrollmentStatus.ACTIVE },
    }),
    prisma.classSession.findMany({
      where: {
        scheduledStart: { gte: todayStart, lt: todayEnd },
      },
      orderBy: { scheduledStart: "asc" },
      select: {
        id: true,
        scheduledStart: true,
        scheduledEnd: true,
        status: true,
        modality: true,
        teacherId: true,
        classGroupId: true,
        classGroup: {
          select: {
            name: true,
            programLevel: {
              select: {
                name: true,
                cefrLevelCode: true,
                program: {
                  select: {
                    name: true,
                    course: { select: { name: true } },
                  },
                },
              },
            },
            enrollments: {
              where: { status: EnrollmentStatus.ACTIVE },
              select: {
                student: {
                  select: {
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
        teacher: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        _count: { select: { participants: true } },
      },
    }),
  ])

  // ---------------------------------------------------------------------------
  //  Agenda + KPI "Clases hoy" (derivados de la misma carga)
  // ---------------------------------------------------------------------------
  const todayCounters = {
    live: 0,
    completed: 0,
    cancelled: 0,
    scheduled: 0,
    no_show: 0,
  }
  const teacherIdsToday = new Set<string>()
  for (const s of todaySessionRows) {
    teacherIdsToday.add(s.teacherId)
    if (s.status === SessionStatus.COMPLETED) todayCounters.completed += 1
    else if (s.status === SessionStatus.CANCELLED) todayCounters.cancelled += 1
    else if (s.status === SessionStatus.NO_SHOW) todayCounters.no_show += 1
    else {
      const isLive =
        s.scheduledStart.getTime() <= now.getTime() &&
        now.getTime() < s.scheduledEnd.getTime()
      if (isLive) todayCounters.live += 1
      else todayCounters.scheduled += 1
    }
  }

  const agenda: AdminAgendaEntry[] = todaySessionRows
    .slice(0, AGENDA_LIMIT)
    .map((s) => {
      const enrollments = s.classGroup.enrollments
      const primaryLabel =
        enrollments.length === 1 && enrollments[0]
          ? `${enrollments[0].student.user.firstName} ${enrollments[0].student.user.lastName}`
          : s.classGroup.name
      const isLive =
        s.status === SessionStatus.SCHEDULED &&
        s.scheduledStart.getTime() <= now.getTime() &&
        now.getTime() < s.scheduledEnd.getTime()
      const liftedStatus: AdminAgendaEntry["status"] =
        s.status === SessionStatus.COMPLETED
          ? "completed"
          : s.status === SessionStatus.CANCELLED
            ? "cancelled"
            : s.status === SessionStatus.NO_SHOW
              ? "no_show"
              : isLive
                ? "live"
                : "scheduled"
      const teacherFirst = s.teacher.user.firstName
      const teacherLast = s.teacher.user.lastName
      return {
        id: s.id,
        scheduledStart: s.scheduledStart,
        scheduledEnd: s.scheduledEnd,
        classGroupId: s.classGroupId,
        primaryLabel,
        programLabel: `${s.classGroup.programLevel.program.course.name} · ${s.classGroup.programLevel.program.name}`,
        cefrLevelCode: s.classGroup.programLevel.cefrLevelCode,
        modality: s.modality,
        teacherInitials: initials(`${teacherFirst} ${teacherLast}`),
        teacherName: `${teacherFirst[0] ?? ""}. ${teacherLast}`.trim(),
        status: liftedStatus,
        participantCount: s._count.participants,
      }
    })

  // ---------------------------------------------------------------------------
  //  Postulaciones pendientes
  // ---------------------------------------------------------------------------
  const pendingRows = await prisma.teacherApplication.findMany({
    where: { status: ApplicationStatus.PENDING },
    orderBy: { createdAt: "desc" },
    take: PENDINGS_LIMIT,
    include: {
      appliedLevels: { include: { level: true } },
    },
  })
  const pendingApplicationsList: AdminPendingApplication[] = pendingRows.map(
    (a) => ({
      id: a.id,
      fullName: `${a.firstName} ${a.lastName}`,
      initials: initials(`${a.firstName} ${a.lastName}`),
      email: a.email,
      levelsLabel: buildLevelsLabel(
        a.appliedLevels.map((l) => l.level.code),
      ),
      createdAt: a.createdAt,
    }),
  )

  // ---------------------------------------------------------------------------
  //  Carga por docente
  // ---------------------------------------------------------------------------
  const teacherProfiles = await prisma.teacherProfile.findMany({
    where: {
      isActive: true,
      user: { status: UserStatus.ACTIVE },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
      teacherAssignments: {
        where: {
          endDate: null,
          classGroup: { status: ClassGroupStatus.ACTIVE },
        },
        select: {
          classGroup: {
            select: {
              slots: { select: { durationMinutes: true } },
            },
          },
        },
      },
      availability: {
        select: { startTime: true, endTime: true },
      },
      teachableLevels: {
        include: { level: true },
      },
    },
  })

  const teacherLoadRows = teacherProfiles
    .map<AdminTeacherLoad>((t) => {
      const assignedMinutes = t.teacherAssignments.reduce(
        (acc, a) =>
          acc + a.classGroup.slots.reduce((s, sl) => s + sl.durationMinutes, 0),
        0,
      )
      const capacityMinutes =
        t.availability.length > 0
          ? t.availability.reduce(
              (acc, a) => acc + minutesBetween(a.startTime, a.endTime),
              0,
            )
          : WEEKLY_CAPACITY_HOURS_DEFAULT * 60
      return {
        id: t.userId,
        fullName: `${t.user.firstName} ${t.user.lastName}`,
        initials: initials(`${t.user.firstName} ${t.user.lastName}`),
        cefrLabel: buildLevelsLabel(t.teachableLevels.map((l) => l.level.code)),
        hours: round1(assignedMinutes / 60),
        capacity: round1(capacityMinutes / 60),
      }
    })
    .sort((a, b) => b.hours / b.capacity - a.hours / a.capacity)
  const teacherLoad = teacherLoadRows.slice(0, TEACHER_LOAD_LIMIT)
  const activeTeachersCount = teacherProfiles.length

  // Utilización promedio ponderada por capacidad — más representativa que un
  // promedio simple porque pondera por las horas disponibles de cada docente.
  const totalAssigned = teacherLoadRows.reduce((a, t) => a + t.hours, 0)
  const totalCapacity = teacherLoadRows.reduce((a, t) => a + t.capacity, 0)
  const teacherUtilizationPct =
    totalCapacity > 0
      ? Math.round((totalAssigned / totalCapacity) * 100)
      : null

  // ---------------------------------------------------------------------------
  //  Distribución por nivel CEFR (matrículas activas)
  // ---------------------------------------------------------------------------
  const cefrGroups = await prisma.enrollment.groupBy({
    by: ["programLevelId"],
    where: { status: EnrollmentStatus.ACTIVE },
    _count: { _all: true },
  })
  let basico = 0
  let intermedio = 0
  let avanzado = 0
  let sin = 0
  if (cefrGroups.length > 0) {
    const ids = cefrGroups.map((g) => g.programLevelId)
    const levelsRich = await prisma.programLevel.findMany({
      where: { id: { in: ids } },
      select: { id: true, cefrLevelCode: true },
    })
    const cefrById = new Map(
      levelsRich.map((l) => [l.id, l.cefrLevelCode ?? null] as const),
    )
    for (const g of cefrGroups) {
      const cefr = cefrById.get(g.programLevelId) ?? null
      if (cefr === null) sin += g._count._all
      else if (cefr.startsWith("A")) basico += g._count._all
      else if (cefr.startsWith("B")) intermedio += g._count._all
      else if (cefr.startsWith("C")) avanzado += g._count._all
      else sin += g._count._all
    }
  }
  const total = activeEnrollments
  const levels: AdminLevelDistribution[] = []
  if (basico > 0) {
    levels.push({
      id: "basico",
      name: "Principiante",
      tag: "A1 · A2",
      count: basico,
      total,
    })
  }
  if (intermedio > 0) {
    levels.push({
      id: "intermedio",
      name: "Intermedio",
      tag: "B1 · B2",
      count: intermedio,
      total,
    })
  }
  if (avanzado > 0) {
    levels.push({
      id: "avanzado",
      name: "Avanzado",
      tag: "C1 · C2",
      count: avanzado,
      total,
    })
  }
  if (sin > 0) {
    levels.push({
      id: "sin",
      name: "Sin CEFR",
      tag: "general / kids",
      count: sin,
      total,
    })
  }

  // ---------------------------------------------------------------------------
  //  Actividad reciente — fusión de varios feeds, top-N por timestamp
  // ---------------------------------------------------------------------------
  const [appRecent, sessionsRecent, enrollmentsRecent, testsRecent] =
    await Promise.all([
      prisma.teacherApplication.findMany({
        where: { createdAt: { gte: weekAgo } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
        },
      }),
      prisma.classSession.findMany({
        where: {
          status: { in: [SessionStatus.COMPLETED, SessionStatus.CANCELLED, SessionStatus.NO_SHOW] },
          scheduledEnd: { gte: weekAgo },
        },
        orderBy: { scheduledEnd: "desc" },
        take: 8,
        select: {
          id: true,
          status: true,
          actualEnd: true,
          cancelledAt: true,
          scheduledEnd: true,
          classGroupId: true,
          classGroup: { select: { name: true } },
          teacher: {
            select: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.enrollment.findMany({
        where: { createdAt: { gte: weekAgo } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          createdAt: true,
          student: {
            select: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          programLevel: {
            select: {
              name: true,
              program: { select: { name: true } },
            },
          },
        },
      }),
      prisma.testSession.findMany({
        where: {
          submittedAt: { gte: weekAgo, not: null },
        },
        orderBy: { submittedAt: "desc" },
        take: 5,
        select: {
          id: true,
          candidateName: true,
          submittedAt: true,
          finalScore: true,
          autoScore: true,
          maxAutoScore: true,
        },
      }),
    ])

  const activityItems: AdminActivityItem[] = []
  for (const a of appRecent) {
    if (a.status === ApplicationStatus.PENDING) {
      activityItems.push({
        id: `app_new_${a.id}`,
        kind: "application_new",
        at: a.createdAt,
        primary: `${a.firstName} ${a.lastName} envió postulación de docente`,
        secondary: null,
        href: `/admin/postulaciones/${a.id}`,
      })
    } else if (a.status === ApplicationStatus.APPROVED && a.reviewedAt) {
      activityItems.push({
        id: `app_approved_${a.id}`,
        kind: "application_approved",
        at: a.reviewedAt,
        primary: `Aprobaste a ${a.firstName} ${a.lastName}`,
        secondary: null,
        href: `/admin/postulaciones/${a.id}`,
      })
    } else if (a.status === ApplicationStatus.REJECTED && a.reviewedAt) {
      activityItems.push({
        id: `app_rejected_${a.id}`,
        kind: "application_rejected",
        at: a.reviewedAt,
        primary: `Rechazaste la postulación de ${a.firstName} ${a.lastName}`,
        secondary: null,
        href: `/admin/postulaciones/${a.id}`,
      })
    }
  }
  for (const s of sessionsRecent) {
    const at = s.actualEnd ?? s.cancelledAt ?? s.scheduledEnd
    const teacherName = `${s.teacher.user.firstName[0] ?? ""}. ${s.teacher.user.lastName}`.trim()
    if (s.status === SessionStatus.COMPLETED) {
      activityItems.push({
        id: `s_completed_${s.id}`,
        kind: "session_completed",
        at,
        primary: `${teacherName} cerró clase`,
        secondary: s.classGroup.name,
        href: `/admin/aulas/${s.classGroupId}`,
      })
    } else if (s.status === SessionStatus.CANCELLED) {
      activityItems.push({
        id: `s_cancelled_${s.id}`,
        kind: "session_cancelled",
        at,
        primary: "Clase cancelada",
        secondary: `${s.classGroup.name} · ${teacherName}`,
        href: `/admin/aulas/${s.classGroupId}`,
      })
    } else {
      activityItems.push({
        id: `s_noshow_${s.id}`,
        kind: "session_no_show",
        at,
        primary: "Auto-cierre · clase sin registro",
        secondary: `${s.classGroup.name} · ${teacherName}`,
        href: `/admin/aulas/${s.classGroupId}`,
      })
    }
  }
  for (const e of enrollmentsRecent) {
    activityItems.push({
      id: `e_new_${e.id}`,
      kind: "enrollment_new",
      at: e.createdAt,
      primary: `${e.student.user.firstName} ${e.student.user.lastName} se matriculó`,
      secondary: `${e.programLevel.program.name} · ${e.programLevel.name}`,
      href: null,
    })
  }
  for (const t of testsRecent) {
    if (!t.submittedAt) continue
    const score =
      t.finalScore ?? t.autoScore ?? 0
    const max = t.maxAutoScore ?? 0
    const scoreLabel = max > 0 ? `${score}/${max}` : `${score} pts`
    activityItems.push({
      id: `t_${t.id}`,
      kind: "test_submitted",
      at: t.submittedAt,
      primary: `${t.candidateName} completó prueba de nivel`,
      secondary: scoreLabel,
      href: `/admin/pruebas/${t.id}`,
    })
  }

  const recentActivity = activityItems
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, ACTIVITY_LIMIT)

  return {
    kpis: {
      activeStudents,
      todaySessions: {
        total: todaySessionRows.length,
        live: todayCounters.live,
        completed: todayCounters.completed,
        cancelled: todayCounters.cancelled,
        scheduled: todayCounters.scheduled,
      },
      pendingApplications,
      teacherUtilizationPct,
      activeEnrollments,
    },
    agenda,
    totalTeachersToday: teacherIdsToday.size,
    recentActivity,
    pendingApplications: pendingApplicationsList,
    teacherLoad,
    activeTeachersCount,
    levels,
  }
}

// =============================================================================
//  Helpers
// =============================================================================

function initials(fullName: string): string {
  const parts = fullName.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "—"
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "").toUpperCase()
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

function buildLevelsLabel(codes: string[]): string {
  if (codes.length === 0) return "Sin niveles cargados"
  const sorted = [...new Set(codes)].sort()
  if (sorted.length <= 2) return sorted.join(" · ")
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  return `${first} – ${last}`
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number) as [number, number]
  const [eh, em] = end.split(":").map(Number) as [number, number]
  return eh * 60 + em - (sh * 60 + sm)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
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
