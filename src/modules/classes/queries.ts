import "server-only"
import {
  AttendanceStatus,
  Prisma,
  SessionStatus,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Lecturas del módulo `classes`. Devuelve datos para:
 *   - El listado de "Mis clases" del docente (`/docente/clases`).
 *   - El detalle de una sesión con participantes + bitácora.
 *
 * Las fechas se persisten en UTC y se convierten a hora local Guayaquil al
 * formatear en UI — acá las devolvemos como `Date` y la UI usa Intl.
 */

export type TeacherSessionListItem = {
  id: string
  classGroupId: string
  classGroupName: string
  programLabel: string
  scheduledStart: Date
  scheduledEnd: Date
  status: SessionStatus
  modality: string
  meetingUrl: string | null
  location: string | null
  participantCount: number
  hasLog: boolean
}

type ListOpts = {
  /** Inclusivo, UTC. */
  from?: Date
  /** Inclusivo, UTC. */
  to?: Date
  status?: SessionStatus[]
  /** Si se pasa, solo trae sesiones del aula. Útil para drill-down. */
  classGroupId?: string
  limit?: number
}

export async function listTeacherSessions(
  teacherId: string,
  opts: ListOpts = {},
): Promise<TeacherSessionListItem[]> {
  const where: Prisma.ClassSessionWhereInput = {
    teacherId,
    ...(opts.classGroupId ? { classGroupId: opts.classGroupId } : {}),
    ...(opts.status ? { status: { in: opts.status } } : {}),
    ...(opts.from || opts.to
      ? {
          scheduledStart: {
            ...(opts.from ? { gte: opts.from } : {}),
            ...(opts.to ? { lte: opts.to } : {}),
          },
        }
      : {}),
  }

  const rows = await prisma.classSession.findMany({
    where,
    orderBy: { scheduledStart: "asc" },
    take: opts.limit,
    select: {
      id: true,
      classGroupId: true,
      scheduledStart: true,
      scheduledEnd: true,
      status: true,
      modality: true,
      meetingUrl: true,
      location: true,
      log: { select: { id: true } },
      _count: { select: { participants: true } },
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

  return rows.map((s) => ({
    id: s.id,
    classGroupId: s.classGroupId,
    classGroupName: s.classGroup.name,
    programLabel: `${s.classGroup.programLevel.program.course.name} · ${s.classGroup.programLevel.program.name} · ${s.classGroup.programLevel.name}`,
    scheduledStart: s.scheduledStart,
    scheduledEnd: s.scheduledEnd,
    status: s.status,
    modality: s.modality,
    meetingUrl: s.meetingUrl,
    location: s.location,
    participantCount: s._count.participants,
    hasLog: s.log !== null,
  }))
}

// -----------------------------------------------------------------------------
//  Detalle
// -----------------------------------------------------------------------------

export type ClassSessionParticipant = {
  id: string
  studentId: string
  studentName: string
  attendance: AttendanceStatus
  notes: string | null
  /** Cuándo el alumno avisó su ausencia (si avisó). */
  noticedAbsenceAt: Date | null
  /** Nota dada por el alumno al avisar (si la dio). */
  absenceNote: string | null
}

export type ClassSessionDetail = {
  id: string
  classGroupId: string
  classGroupName: string
  programLabel: string
  teacherId: string
  scheduledStart: Date
  scheduledEnd: Date
  actualStart: Date | null
  actualEnd: Date | null
  modality: string
  meetingUrl: string | null
  location: string | null
  status: SessionStatus
  cancelledAt: Date | null
  cancelReason: string | null
  participants: ClassSessionParticipant[]
  log: {
    topic: string
    activities: string
    homework: string | null
    materialsUsed: string | null
  } | null
}

export async function getClassSessionDetail(
  id: string,
): Promise<ClassSessionDetail | null> {
  const row = await prisma.classSession.findUnique({
    where: { id },
    include: {
      classGroup: {
        select: {
          name: true,
          programLevel: {
            select: {
              name: true,
              program: {
                select: { name: true, course: { select: { name: true } } },
              },
            },
          },
        },
      },
      participants: {
        orderBy: { id: "asc" },
        include: {
          enrollment: {
            select: {
              student: {
                select: {
                  user: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
      },
      log: true,
    },
  })
  if (!row) return null

  return {
    id: row.id,
    classGroupId: row.classGroupId,
    classGroupName: row.classGroup.name,
    programLabel: `${row.classGroup.programLevel.program.course.name} · ${row.classGroup.programLevel.program.name} · ${row.classGroup.programLevel.name}`,
    teacherId: row.teacherId,
    scheduledStart: row.scheduledStart,
    scheduledEnd: row.scheduledEnd,
    actualStart: row.actualStart,
    actualEnd: row.actualEnd,
    modality: row.modality,
    meetingUrl: row.meetingUrl,
    location: row.location,
    status: row.status,
    cancelledAt: row.cancelledAt,
    cancelReason: row.cancelReason,
    participants: row.participants.map((p) => ({
      id: p.id,
      studentId: p.enrollment.student.user.id,
      studentName: `${p.enrollment.student.user.firstName} ${p.enrollment.student.user.lastName}`,
      attendance: p.attendance,
      notes: p.notes,
      noticedAbsenceAt: p.noticedAbsenceAt,
      absenceNote: p.absenceNote,
    })),
    log: row.log
      ? {
          topic: row.log.topic,
          activities: row.log.activities,
          homework: row.log.homework,
          materialsUsed: row.log.materialsUsed,
        }
      : null,
  }
}

// -----------------------------------------------------------------------------
//  Listado de clases del estudiante (para `/estudiante/clases`)
// -----------------------------------------------------------------------------

export type StudentSessionListItem = {
  id: string
  classGroupId: string
  classGroupName: string
  programLabel: string
  scheduledStart: Date
  scheduledEnd: Date
  status: SessionStatus
  modality: string
  meetingUrl: string | null
  location: string | null
  teacherName: string | null
  attendance: AttendanceStatus | null
  cancelReason: string | null
}

type StudentListOpts = {
  /** Inclusivo, UTC. */
  from?: Date
  /** Inclusivo, UTC. */
  to?: Date
  status?: SessionStatus[]
  limit?: number
}

export async function listStudentSessions(
  studentId: string,
  opts: StudentListOpts = {},
): Promise<StudentSessionListItem[]> {
  const rows = await prisma.classParticipant.findMany({
    where: {
      enrollment: { studentId },
      session: {
        ...(opts.status ? { status: { in: opts.status } } : {}),
        ...(opts.from || opts.to
          ? {
              scheduledStart: {
                ...(opts.from ? { gte: opts.from } : {}),
                ...(opts.to ? { lte: opts.to } : {}),
              },
            }
          : {}),
      },
    },
    orderBy: { session: { scheduledStart: "asc" } },
    take: opts.limit,
    select: {
      attendance: true,
      session: {
        select: {
          id: true,
          classGroupId: true,
          scheduledStart: true,
          scheduledEnd: true,
          status: true,
          modality: true,
          meetingUrl: true,
          location: true,
          cancelReason: true,
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
          teacher: {
            select: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  })

  return rows.map((p) => ({
    id: p.session.id,
    classGroupId: p.session.classGroupId,
    classGroupName: p.session.classGroup.name,
    programLabel: `${p.session.classGroup.programLevel.program.course.name} · ${p.session.classGroup.programLevel.program.name} · ${p.session.classGroup.programLevel.name}`,
    scheduledStart: p.session.scheduledStart,
    scheduledEnd: p.session.scheduledEnd,
    status: p.session.status,
    modality: p.session.modality,
    meetingUrl: p.session.meetingUrl,
    location: p.session.location,
    teacherName: p.session.teacher
      ? `${p.session.teacher.user.firstName} ${p.session.teacher.user.lastName}`
      : null,
    attendance: p.attendance,
    cancelReason: p.session.cancelReason,
  }))
}

// -----------------------------------------------------------------------------
//  Próxima clase del estudiante (para el dashboard)
// -----------------------------------------------------------------------------

export type StudentNextSession = {
  id: string
  scheduledStart: Date
  scheduledEnd: Date
  modality: string
  meetingUrl: string | null
  location: string | null
  classGroupName: string
  teacherName: string | null
}

export async function getStudentNextSession(
  studentId: string,
): Promise<StudentNextSession | null> {
  const row = await prisma.classParticipant.findFirst({
    where: {
      enrollment: { studentId },
      session: {
        status: SessionStatus.SCHEDULED,
        scheduledEnd: { gte: new Date() },
      },
    },
    orderBy: { session: { scheduledStart: "asc" } },
    select: {
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
  if (!row) return null

  return {
    id: row.session.id,
    scheduledStart: row.session.scheduledStart,
    scheduledEnd: row.session.scheduledEnd,
    modality: row.session.modality,
    meetingUrl: row.session.meetingUrl,
    location: row.session.location,
    classGroupName: row.session.classGroup.name,
    teacherName: row.session.teacher
      ? `${row.session.teacher.user.firstName} ${row.session.teacher.user.lastName}`
      : null,
  }
}
