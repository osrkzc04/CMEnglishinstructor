import "server-only"
import { ClassGroupStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { formatGuayaquilCalendarDate, materializeClassSessions } from "./materialize"

/**
 * Job que materializa el horizonte de sesiones para **todas las aulas
 * activas** con docente vigente. Pensado para correrse semanalmente:
 *
 *   - Cron del hosting (cPanel/Plesk) o Vercel Cron pega al endpoint
 *     `/api/cron/materialize-sessions` con `Authorization: Bearer
 *     CRON_SECRET`.
 *   - En producción Node, el `scheduler` in-process también lo dispara
 *     (ver `src/lib/jobs/scheduler.ts`).
 *
 * Horizonte: `WEEKS_AHEAD = 4` semanas hacia adelante desde hoy
 * (Guayaquil). Una corrida semanal con 4 semanas de buffer garantiza que
 * cualquier estudiante o docente siempre tenga al menos 3 semanas de
 * clases visibles, aunque el job se atrase o el server reinicie.
 *
 * Idempotencia: `materializeClassSessions` no recrea sesiones existentes
 * (clave `(classGroupId, scheduledStart)` única en práctica). Saltea
 * feriados y bloques de `TeacherUnavailability`.
 *
 * Errores: si una sola aula falla (ej. perdió al docente entre el filtro
 * y la materialización), se registra en `errors[]` y el job sigue con el
 * resto. No abortamos por un caso particular.
 */

const WEEKS_AHEAD = 4

export type MaterializeUpcomingSummary = {
  groupsProcessed: number
  totalCreated: number
  totalSkipped: number
  errors: { classGroupId: string; reason: string }[]
}

export async function materializeUpcomingForAllActive(): Promise<MaterializeUpcomingSummary> {
  const today = new Date()
  const horizonEnd = new Date(today.getTime() + WEEKS_AHEAD * 7 * 86_400_000)
  const fromDate = formatGuayaquilCalendarDate(today)
  const toDate = formatGuayaquilCalendarDate(horizonEnd)

  const groups = await prisma.classGroup.findMany({
    where: {
      status: ClassGroupStatus.ACTIVE,
      teacherAssignments: { some: { endDate: null } },
    },
    select: { id: true },
  })

  const summary: MaterializeUpcomingSummary = {
    groupsProcessed: 0,
    totalCreated: 0,
    totalSkipped: 0,
    errors: [],
  }

  for (const g of groups) {
    summary.groupsProcessed += 1
    try {
      const outcome = await prisma.$transaction(
        async (tx) =>
          materializeClassSessions(tx, {
            classGroupId: g.id,
            fromDate,
            toDate,
          }),
        { maxWait: 10_000, timeout: 60_000 },
      )
      if ("kind" in outcome) {
        summary.errors.push({ classGroupId: g.id, reason: outcome.kind })
      } else {
        summary.totalCreated += outcome.created
        summary.totalSkipped +=
          outcome.skippedAlreadyExists + outcome.skippedHoliday + outcome.skippedUnavailable
      }
    } catch (err) {
      summary.errors.push({
        classGroupId: g.id,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return summary
}
