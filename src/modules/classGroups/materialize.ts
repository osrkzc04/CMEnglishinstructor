import "server-only"
import { ClassGroupStatus, EnrollmentStatus, Prisma, SessionStatus } from "@prisma/client"

/**
 * Materializa instancias `ClassSession` (con sus `ClassParticipant`) a partir
 * del patrón semanal del aula.
 *
 * **Zona horaria.** Los `ClassGroupSlot.startTime` están en formato HH:mm
 * interpretados como hora local de Guayaquil (UTC-5, sin DST). En la DB todo
 * `DateTime` se guarda en UTC. Acá traducimos: para el día calendario X en
 * Guayaquil, "18:00" se persiste como `Date.UTC(X, 23:00)`.
 *
 * **Idempotencia.** No re-crea sesiones ya existentes — la unicidad es
 * `(classGroupId, scheduledStart)`. Llamar dos veces con el mismo rango es
 * seguro: la segunda no hace nada.
 *
 * **Pre-requisitos.** El aula debe estar ACTIVE y tener un
 * `TeacherAssignment` vigente (sin `endDate`). Si no, devuelve un error que
 * la action wrappea como mensaje al usuario.
 *
 * **Filtros aplicados:**
 *   - Saltea fechas marcadas como `Holiday`.
 *   - Saltea fechas dentro de `TeacherUnavailability` del docente vigente.
 *
 * **Participantes.** Se crea una fila `ClassParticipant` por cada
 * `Enrollment` ACTIVE asociada al aula al momento de materializar. Si la
 * coordinación suma una matrícula después, hay que sumar manualmente los
 * `ClassParticipant` para las sesiones futuras ya creadas — esa lógica vive
 * en `addEnrollment.action.ts`.
 */

const GUAYAQUIL_OFFSET_MINUTES = -300 // UTC-5 fijo

export type MaterializeArgs = {
  classGroupId: string
  /** Fecha (YYYY-MM-DD, hora local Guayaquil) inclusiva. */
  fromDate: string
  /** Fecha (YYYY-MM-DD, hora local Guayaquil) inclusiva. */
  toDate: string
}

export type MaterializeResult = {
  created: number
  skippedHoliday: number
  skippedUnavailable: number
  skippedAlreadyExists: number
}

export type MaterializeError =
  | { kind: "group_not_found" }
  | { kind: "group_not_active" }
  | { kind: "no_active_teacher" }
  | { kind: "invalid_range" }

/**
 * Ejecuta la materialización dentro de una transacción provista por el caller.
 * Eso permite componerla con otras operaciones (ej. al cambiar de docente,
 * borrar futuras + materializar para el nuevo docente atómicamente).
 */
export async function materializeClassSessions(
  tx: Prisma.TransactionClient,
  args: MaterializeArgs,
): Promise<MaterializeResult | MaterializeError> {
  if (args.fromDate > args.toDate) return { kind: "invalid_range" }

  const group = await tx.classGroup.findUnique({
    where: { id: args.classGroupId },
    select: {
      id: true,
      status: true,
      modality: true,
      defaultMeetingUrl: true,
      defaultLocation: true,
      slots: {
        select: { dayOfWeek: true, startTime: true, durationMinutes: true },
      },
      teacherAssignments: {
        where: { endDate: null },
        select: { teacherId: true },
        take: 1,
      },
      enrollments: {
        where: { status: EnrollmentStatus.ACTIVE },
        select: { id: true },
      },
    },
  })

  if (!group) return { kind: "group_not_found" }
  if (group.status !== ClassGroupStatus.ACTIVE) return { kind: "group_not_active" }
  const teacherId = group.teacherAssignments[0]?.teacherId
  if (!teacherId) return { kind: "no_active_teacher" }

  // Cargar holidays del rango y unavailability del docente. Se traen una
  // sola vez y se cruzan en memoria — son colecciones chicas.
  const dates = eachGuayaquilDateInRange(args.fromDate, args.toDate)
  if (dates.length === 0) return blankResult()

  const rangeStartUtc = guayaquilDateToUtc(dates[0]!, "00:00")
  const rangeEndUtc = guayaquilDateToUtc(dates[dates.length - 1]!, "23:59")

  const [holidays, unavailability, existingSessions] = await Promise.all([
    tx.holiday.findMany({
      where: {
        date: { gte: rangeStartUtc, lte: rangeEndUtc },
      },
      select: { date: true },
    }),
    tx.teacherUnavailability.findMany({
      where: {
        teacherId,
        OR: [{ startDate: { lte: rangeEndUtc }, endDate: { gte: rangeStartUtc } }],
      },
      select: { startDate: true, endDate: true },
    }),
    tx.classSession.findMany({
      where: {
        classGroupId: group.id,
        scheduledStart: { gte: rangeStartUtc, lte: rangeEndUtc },
      },
      select: { scheduledStart: true },
    }),
  ])

  const holidayDates = new Set(holidays.map((h) => formatGuayaquilCalendarDate(h.date)))
  const existingStarts = new Set(existingSessions.map((s) => s.scheduledStart.getTime()))

  const result: MaterializeResult = blankResult()

  for (const dateStr of dates) {
    const dow = dayOfWeekForGuayaquilDate(dateStr)
    const slotsForDay = group.slots.filter((s) => s.dayOfWeek === dow)
    if (slotsForDay.length === 0) continue

    if (holidayDates.has(dateStr)) {
      result.skippedHoliday += slotsForDay.length
      continue
    }

    for (const slot of slotsForDay) {
      const scheduledStart = guayaquilDateToUtc(dateStr, slot.startTime)
      const scheduledEnd = new Date(scheduledStart.getTime() + slot.durationMinutes * 60_000)

      if (existingStarts.has(scheduledStart.getTime())) {
        result.skippedAlreadyExists += 1
        continue
      }

      // Bloque por unavailability del docente — comparamos el día calendario
      // (Guayaquil) de la sesión contra el rango [startDate, endDate]. Esto
      // evita la trampa de "endDate guardado como medianoche UTC del último
      // día" que dejaría afuera sesiones de ese mismo día por la tarde.
      const sessionDay = formatGuayaquilCalendarDate(scheduledStart)
      const isUnavailable = unavailability.some((u) => {
        const startDay = formatGuayaquilCalendarDate(u.startDate)
        const endDay = formatGuayaquilCalendarDate(u.endDate)
        return sessionDay >= startDay && sessionDay <= endDay
      })
      if (isUnavailable) {
        result.skippedUnavailable += 1
        continue
      }

      const session = await tx.classSession.create({
        data: {
          classGroupId: group.id,
          teacherId,
          scheduledStart,
          scheduledEnd,
          modality: group.modality,
          meetingUrl: group.defaultMeetingUrl,
          location: group.defaultLocation,
          status: SessionStatus.SCHEDULED,
        },
        select: { id: true },
      })

      if (group.enrollments.length > 0) {
        await tx.classParticipant.createMany({
          data: group.enrollments.map((e) => ({
            sessionId: session.id,
            enrollmentId: e.id,
          })),
        })
      }

      result.created += 1
      existingStarts.add(scheduledStart.getTime())
    }
  }

  return result
}

// -----------------------------------------------------------------------------
//  Helpers TZ — Guayaquil = UTC-5 fijo, sin DST
// -----------------------------------------------------------------------------

/** Itera fechas calendario de Guayaquil en formato YYYY-MM-DD, inclusive en ambos extremos. */
export function eachGuayaquilDateInRange(from: string, to: string): string[] {
  const result: string[] = []
  const [y0, m0, d0] = parseDateString(from)
  const [y1, m1, d1] = parseDateString(to)
  const start = Date.UTC(y0, m0 - 1, d0)
  const end = Date.UTC(y1, m1 - 1, d1)
  for (let t = start; t <= end; t += 86_400_000) {
    const d = new Date(t)
    result.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`)
  }
  return result
}

export function dayOfWeekForGuayaquilDate(dateStr: string): number {
  const [y, m, d] = parseDateString(dateStr)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Convierte (fecha local Guayaquil, hh:mm) a un `Date` en UTC. */
export function guayaquilDateToUtc(dateStr: string, hhmm: string): Date {
  const [y, m, d] = parseDateString(dateStr)
  const [h, min] = hhmm.split(":").map(Number) as [number, number]
  // Guayaquil offset = -300 min. UTC = local - offset, en minutos.
  // Local 18:00 + (-(-300)) = 18:00 + 300 = 23:00 UTC. ✓
  return new Date(Date.UTC(y, m - 1, d, h, min - GUAYAQUIL_OFFSET_MINUTES))
}

/** Devuelve YYYY-MM-DD en hora local Guayaquil para un `Date`. */
export function formatGuayaquilCalendarDate(d: Date): string {
  const localMs = d.getTime() + GUAYAQUIL_OFFSET_MINUTES * 60_000
  const local = new Date(localMs)
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`
}

function parseDateString(dateStr: string): [number, number, number] {
  const [y, m, d] = dateStr.split("-").map(Number)
  return [y!, m!, d!]
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function blankResult(): MaterializeResult {
  return {
    created: 0,
    skippedHoliday: 0,
    skippedUnavailable: 0,
    skippedAlreadyExists: 0,
  }
}

// -----------------------------------------------------------------------------
//  Suplemento usado por addEnrollment para llenar sesiones futuras existentes
// -----------------------------------------------------------------------------

/**
 * Crea `ClassParticipant` para todas las sesiones SCHEDULED futuras del aula
 * para una matrícula recién agregada. Idempotente vía la unique
 * `(sessionId, enrollmentId)` — no fallamos si la fila ya existe.
 */
export async function attachEnrollmentToFutureSessions(
  tx: Prisma.TransactionClient,
  args: { classGroupId: string; enrollmentId: string; nowUtc?: Date },
): Promise<{ created: number }> {
  const now = args.nowUtc ?? new Date()
  const sessions = await tx.classSession.findMany({
    where: {
      classGroupId: args.classGroupId,
      status: SessionStatus.SCHEDULED,
      scheduledStart: { gt: now },
    },
    select: { id: true },
  })
  if (sessions.length === 0) return { created: 0 }

  const result = await tx.classParticipant.createMany({
    data: sessions.map((s) => ({
      sessionId: s.id,
      enrollmentId: args.enrollmentId,
    })),
    skipDuplicates: true,
  })
  return { created: result.count }
}
