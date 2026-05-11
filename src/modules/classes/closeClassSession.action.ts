"use server"

import { revalidatePath } from "next/cache"
import { Prisma, SessionStatus, AttendanceStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { CloseClassSessionSchema, type CloseClassSessionInput } from "./schemas"
import { requireSessionEditor } from "./authorize"

type Result =
  | {
      success: true
      hoursPerParticipant: string
      participantsCounted: number
    }
  | { success: false; error: string }

/**
 * Cierra una sesión: snapshot de tarifa, cálculo de `hoursCounted` por
 * participante según asistencia, suma a `Enrollment.consumedHours`, y marca
 * la sesión como COMPLETED. Todo en una sola transacción para que el saldo
 * del estudiante sea siempre consistente.
 *
 * Reglas (alineadas con `docs/flows/05-class-session.md`):
 *   - Cierra solo desde SCHEDULED. COMPLETED, CANCELLED, NO_SHOW no se
 *     cierran de nuevo.
 *   - Bitácora obligatoria. Sin `ClassLog`, no cierra.
 *   - `actualEnd` se setea a `min(now, scheduledEnd)` cuando la sesión no
 *     fue marcada antes — evitamos sobre-contabilizar si el docente cierra
 *     mucho después.
 *   - Política de ausencia 24h:
 *       PRESENT / LATE                                  → cuenta horas
 *       ABSENT con aviso ≥24h antes (`noticedAbsenceAt`)→ NO cuenta (queda
 *         pendiente para reponer)
 *       ABSENT sin aviso o aviso tardío (<24h)          → cuenta (penaliza)
 *       EXCUSED                                         → no cuenta (admin
 *         marca justificada por contexto fuera del sistema)
 *       PENDING                                         → bloquea cierre
 */
export async function closeClassSession(input: CloseClassSessionInput): Promise<Result> {
  const parsed = CloseClassSessionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const sessionId = parsed.data.sessionId

  await requireSessionEditor(sessionId)

  // Validaciones previas a la transacción para devolver mensajes claros.
  const pre = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      scheduledStart: true,
      scheduledEnd: true,
      actualStart: true,
      actualEnd: true,
      teacher: { select: { hourlyRate: true } },
      log: { select: { id: true } },
      participants: {
        select: {
          id: true,
          attendance: true,
          enrollmentId: true,
          noticedAbsenceAt: true,
        },
      },
    },
  })
  if (!pre) return { success: false, error: "Sesión no encontrada" }
  if (pre.status !== SessionStatus.SCHEDULED) {
    return { success: false, error: "La sesión ya fue cerrada o cancelada" }
  }
  if (!pre.log) {
    return {
      success: false,
      error: "Cargá la bitácora antes de cerrar la clase",
    }
  }
  if (pre.participants.some((p) => p.attendance === AttendanceStatus.PENDING)) {
    return {
      success: false,
      error: "Marcá la asistencia de todos los alumnos antes de cerrar",
    }
  }

  // Cálculo de horas. Tomamos la duración real acotada por la programada —
  // si el docente cerró tarde no inflamos las horas; si cerró antes, vale
  // la duración real.
  const now = new Date()
  const actualStart = pre.actualStart ?? pre.scheduledStart
  const actualEnd = pre.actualEnd ?? (now < pre.scheduledEnd ? now : pre.scheduledEnd)
  const realMinutes = Math.max(
    0,
    Math.round((actualEnd.getTime() - actualStart.getTime()) / 60_000),
  )
  const scheduledMinutes = Math.round(
    (pre.scheduledEnd.getTime() - pre.scheduledStart.getTime()) / 60_000,
  )
  const baseMinutes = Math.min(realMinutes, scheduledMinutes)
  const baseHoursDecimal = new Prisma.Decimal(baseMinutes).div(60)
  const rateSnapshot = pre.teacher.hourlyRate

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
  let participantsCounted = 0

  await prisma.$transaction(async (tx) => {
    for (const p of pre.participants) {
      const counts = decideHoursCount({
        attendance: p.attendance,
        noticedAbsenceAt: p.noticedAbsenceAt,
        scheduledStart: pre.scheduledStart,
        twentyFourHoursMs: TWENTY_FOUR_HOURS_MS,
      })
      const hoursCounted = counts ? baseHoursDecimal : new Prisma.Decimal(0)

      await tx.classParticipant.update({
        where: { id: p.id },
        data: { hoursCounted, rateSnapshot },
      })

      if (counts) {
        await tx.enrollment.update({
          where: { id: p.enrollmentId },
          data: { consumedHours: { increment: hoursCounted } },
        })
        participantsCounted += 1
      }
    }

    await tx.classSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        actualStart,
        actualEnd,
      },
    })
  })

  revalidatePath(`/docente/clases/${sessionId}`)
  revalidatePath("/docente/clases")
  revalidatePath("/estudiante/dashboard")
  return {
    success: true,
    hoursPerParticipant: baseHoursDecimal.toFixed(2),
    participantsCounted,
  }
}

/**
 * Decide si la asistencia de un participante consume horas según la política
 * de 24h. Pura — testeable de forma aislada.
 */
function decideHoursCount(args: {
  attendance: AttendanceStatus
  noticedAbsenceAt: Date | null
  scheduledStart: Date
  twentyFourHoursMs: number
}): boolean {
  switch (args.attendance) {
    case AttendanceStatus.PRESENT:
    case AttendanceStatus.LATE:
      return true
    case AttendanceStatus.EXCUSED:
      // Justificada por admin/docente fuera del sistema (médico, laboral).
      return false
    case AttendanceStatus.ABSENT: {
      // Si avisó con ≥24h, no consume — queda como hora a reponer. Si avisó
      // tarde o no avisó, sí consume (penaliza).
      if (args.noticedAbsenceAt === null) return true
      const advanceMs = args.scheduledStart.getTime() - args.noticedAbsenceAt.getTime()
      return advanceMs < args.twentyFourHoursMs
    }
    default:
      return false
  }
}
