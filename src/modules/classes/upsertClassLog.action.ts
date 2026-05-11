"use server"

import { revalidatePath } from "next/cache"
import { SessionStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ClassLogSchema, type ClassLogInput } from "./schemas"
import { requireSessionEditor } from "./authorize"

type Result = { success: true } | { success: false; error: string; field?: keyof ClassLogInput }

/**
 * Crea o actualiza la bitácora de la sesión. Es 1:1 con `ClassSession`.
 * Solo aplicable a sesiones SCHEDULED — el cierre congela la bitácora.
 */
export async function upsertClassLog(input: ClassLogInput): Promise<Result> {
  const parsed = ClassLogSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof ClassLogInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  await requireSessionEditor(data.sessionId)

  const session = await prisma.classSession.findUnique({
    where: { id: data.sessionId },
    select: { status: true },
  })
  if (!session) return { success: false, error: "Sesión no encontrada" }
  if (session.status !== SessionStatus.SCHEDULED) {
    return { success: false, error: "La sesión ya fue cerrada o cancelada" }
  }

  await prisma.classLog.upsert({
    where: { sessionId: data.sessionId },
    create: {
      sessionId: data.sessionId,
      topic: data.topic,
      activities: data.activities,
      homework: data.homework ?? null,
      materialsUsed: data.materialsUsed ?? null,
    },
    update: {
      topic: data.topic,
      activities: data.activities,
      homework: data.homework ?? null,
      materialsUsed: data.materialsUsed ?? null,
    },
  })

  revalidatePath(`/docente/clases/${data.sessionId}`)
  return { success: true }
}
