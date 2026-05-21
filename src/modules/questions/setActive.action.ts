"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireRole } from "@/modules/auth/guards"
import { SetQuestionActiveSchema, type SetQuestionActiveInput } from "./schemas"

/**
 * Activa o desactiva una pregunta (soft-delete vía `isActive`).
 *
 * Las preguntas con historia (`TestSessionQuestion` apuntando a ellas) nunca
 * se hard-deletean — esa es la regla del proyecto. Desactivar las saca del
 * sorteo del placement pero conserva los snapshots intactos.
 */

export type SetQuestionActiveResult =
  | { success: true; isActive: boolean }
  | { success: false; error: string }

export async function setQuestionActive(
  input: SetQuestionActiveInput,
): Promise<SetQuestionActiveResult> {
  try {
    await requireRole(["DIRECTOR", "COORDINATOR"])
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { success: false, error: "Sin permisos para esta acción" }
    }
    throw err
  }

  const parsed = SetQuestionActiveSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const data = parsed.data

  const existing = await prisma.question.findUnique({
    where: { id: data.id },
    select: { id: true, isActive: true, level: { select: { code: true } } },
  })
  if (!existing) {
    return { success: false, error: "Pregunta no encontrada" }
  }
  if (existing.isActive === data.isActive) {
    // Idempotente: si ya está en ese estado, devolvemos OK sin tocar.
    return { success: true, isActive: data.isActive }
  }

  await prisma.question.update({
    where: { id: data.id },
    data: { isActive: data.isActive },
  })

  revalidatePath("/admin/preguntas")
  revalidatePath(`/admin/preguntas/${existing.level.code.toLowerCase()}`)

  return { success: true, isActive: data.isActive }
}
