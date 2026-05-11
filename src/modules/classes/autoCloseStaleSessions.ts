import "server-only"
import { AttendanceStatus, SessionStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Auto-cierre de sesiones que el docente dejó sin registrar.
 *
 * Política (definida con el cliente):
 *   - Pasados 5 min del `scheduledEnd`, si una sesión SCHEDULED **no tiene
 *     bitácora** o **alguno de los participantes sigue con asistencia
 *     PENDING**, se marca como NO_SHOW.
 *   - NO se consumen horas. `Enrollment.consumedHours` no se toca. Los
 *     participantes quedan en PENDING — coordinación reconcilia después si
 *     la clase realmente ocurrió.
 *   - Es la contracara de `closeClassSession`: cierre limpio del docente vs.
 *     cierre forzado por inacción.
 *
 * Idempotente: una sesión ya cerrada (COMPLETED / CANCELLED / NO_SHOW) no
 * matchea el filtro y queda intacta.
 *
 * Lo dispara el scheduler in-process cada 5 minutos (`src/lib/jobs/scheduler.ts`)
 * y también el endpoint `/api/cron/auto-close-sessions`.
 */

const STALE_GRACE_MS = 5 * 60 * 1000

export type AutoCloseSummary = {
  closed: number
  /** IDs cerrados — útil para logs/auditoría sin pesar demasiado. */
  sessionIds: string[]
}

export async function autoCloseStaleSessions(): Promise<AutoCloseSummary> {
  const cutoff = new Date(Date.now() - STALE_GRACE_MS)

  const stale = await prisma.classSession.findMany({
    where: {
      status: SessionStatus.SCHEDULED,
      scheduledEnd: { lt: cutoff },
      OR: [
        { log: { is: null } },
        { participants: { some: { attendance: AttendanceStatus.PENDING } } },
      ],
    },
    select: { id: true },
  })

  if (stale.length === 0) return { closed: 0, sessionIds: [] }

  const ids = stale.map((s) => s.id)
  await prisma.classSession.updateMany({
    where: { id: { in: ids } },
    data: { status: SessionStatus.NO_SHOW },
  })

  return { closed: ids.length, sessionIds: ids }
}
