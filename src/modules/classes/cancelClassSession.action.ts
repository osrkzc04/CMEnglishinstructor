"use server"

import { revalidatePath } from "next/cache"
import { SessionCancelledBy, SessionStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { CancelClassSessionSchema, type CancelClassSessionInput } from "./schemas"
import { requireSessionEditor } from "./authorize"

type Result = { success: true; timeliness: "TIMELY" | "LATE" } | { success: false; error: string }

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

/**
 * Cancela una sesión SCHEDULED. No consume horas ni dispara cierre.
 *
 * Registra `cancelledBy` (TEACHER o ADMIN) según el rol del usuario, y
 * devuelve si el aviso fue tardío (`<24h`) — para que la UI advierta al
 * docente que la hora no se le pagará en pasos siguientes (cuando se
 * implemente payroll).
 *
 * Cancelar después del cierre no se permite — revertir un cierre necesita
 * una operación inversa que ajuste `consumedHours` (en backlog).
 */
export async function cancelClassSession(input: CancelClassSessionInput): Promise<Result> {
  const parsed = CancelClassSessionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const data = parsed.data

  const editor = await requireSessionEditor(data.sessionId)

  const session = await prisma.classSession.findUnique({
    where: { id: data.sessionId },
    select: { status: true, scheduledStart: true },
  })
  if (!session) return { success: false, error: "Sesión no encontrada" }
  if (session.status !== SessionStatus.SCHEDULED) {
    return { success: false, error: "Solo se cancelan clases programadas" }
  }

  const now = new Date()
  const advanceMs = session.scheduledStart.getTime() - now.getTime()
  const timeliness: "TIMELY" | "LATE" = advanceMs >= TWENTY_FOUR_HOURS_MS ? "TIMELY" : "LATE"

  const cancelledBy = editor.isAdmin ? SessionCancelledBy.ADMIN : SessionCancelledBy.TEACHER

  await prisma.classSession.update({
    where: { id: data.sessionId },
    data: {
      status: SessionStatus.CANCELLED,
      cancelledAt: now,
      cancelledBy,
      cancelReason: data.reason,
    },
  })

  revalidatePath(`/docente/clases/${data.sessionId}`)
  revalidatePath("/docente/clases")
  revalidatePath("/estudiante/dashboard")
  return { success: true, timeliness }
}
