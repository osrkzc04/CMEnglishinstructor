"use server"

import { revalidatePath } from "next/cache"
import { SessionStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { UpdateAttendanceSchema, type UpdateAttendanceInput } from "./schemas"
import { requireSessionEditor } from "./authorize"

type Result = { success: true } | { success: false; error: string }

/**
 * Auto-save de asistencia. Acepta updates por participante (status + notas)
 * y los persiste de a uno (los volúmenes son chicos: 1-30 alumnos).
 *
 * Solo aplicable a sesiones SCHEDULED — una vez COMPLETED el cierre tomó
 * snapshot, y editar ahí necesitaría una ventana de edición que está fuera
 * del alcance MVP (ver `docs/backlog.md`).
 */
export async function updateAttendance(input: UpdateAttendanceInput): Promise<Result> {
  const parsed = UpdateAttendanceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const data = parsed.data

  await requireSessionEditor(data.sessionId)

  const session = await prisma.classSession.findUnique({
    where: { id: data.sessionId },
    select: { status: true },
  })
  if (!session) return { success: false, error: "Sesión no encontrada" }
  if (session.status !== SessionStatus.SCHEDULED) {
    return {
      success: false,
      error: "La sesión ya fue cerrada o cancelada",
    }
  }

  // Validamos en una sola query que todos los participants pertenezcan a esta
  // sesión — evita que un cliente malicioso edite la asistencia de otra clase.
  const owned = await prisma.classParticipant.findMany({
    where: { sessionId: data.sessionId, id: { in: data.updates.map((u) => u.participantId) } },
    select: { id: true },
  })
  if (owned.length !== data.updates.length) {
    return { success: false, error: "Hay participantes que no pertenecen a esta sesión" }
  }

  await prisma.$transaction(
    data.updates.map((u) =>
      prisma.classParticipant.update({
        where: { id: u.participantId },
        data: { attendance: u.status, notes: u.notes ?? null },
      }),
    ),
  )

  revalidatePath(`/docente/clases/${data.sessionId}`)
  return { success: true }
}
