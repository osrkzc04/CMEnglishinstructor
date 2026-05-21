"use server"

import { revalidatePath } from "next/cache"
import { QuestionType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireRole } from "@/modules/auth/guards"
import { UpdateQuestionSchema, type UpdateQuestionInput } from "./schemas"

/**
 * Actualiza una pregunta existente.
 *
 * Estrategia para opciones / respuestas aceptadas: borramos las viejas y
 * recreamos las nuevas dentro de la misma transacción. Es más simple que
 * hacer diff campo a campo y los snapshots históricos
 * (`TestSessionQuestion.optionsSnapshot`) **no** se ven afectados — esos
 * congelan los IDs y textos al momento del sorteo.
 *
 * Si la pregunta ya fue usada en un intento, el cliente muestra una
 * advertencia antes de guardar; la action no bloquea.
 */

export type UpdateQuestionResult =
  | { success: true; questionId: string }
  | { success: false; error: string; field?: string }

export async function updateQuestion(input: UpdateQuestionInput): Promise<UpdateQuestionResult> {
  try {
    await requireRole(["DIRECTOR", "COORDINATOR"])
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { success: false, error: "Sin permisos para editar preguntas" }
    }
    throw err
  }

  const parsed = UpdateQuestionSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      success: false,
      error: first?.message ?? "Datos inválidos",
      field: first?.path.join(".") || undefined,
    }
  }
  const data = parsed.data

  const existing = await prisma.question.findUnique({
    where: { id: data.id },
    select: { id: true, levelId: true, level: { select: { code: true } } },
  })
  if (!existing) {
    return { success: false, error: "Pregunta no encontrada" }
  }

  const level = await prisma.cefrLevel.findUnique({
    where: { id: data.levelId },
    select: { id: true, code: true },
  })
  if (!level) {
    return { success: false, error: "Nivel no encontrado", field: "levelId" }
  }

  await prisma.$transaction(async (tx) => {
    await tx.question.update({
      where: { id: data.id },
      data: {
        levelId: data.levelId,
        prompt: data.prompt,
        type: data.type,
        topic: data.topic ?? null,
        difficulty: data.difficulty,
        points: data.points,
      },
    })

    // Reemplazo total: borramos todas las opciones / respuestas y volvemos a
    // crear las del input. Los snapshots vivos (TestSessionQuestion) no se
    // tocan — congelan los datos en el momento del sorteo.
    await tx.questionOption.deleteMany({ where: { questionId: data.id } })
    await tx.questionFillAnswer.deleteMany({ where: { questionId: data.id } })

    if (data.type === QuestionType.MULTIPLE_CHOICE) {
      await tx.questionOption.createMany({
        data: data.options.map((o, i) => ({
          questionId: data.id,
          text: o.text,
          isCorrect: o.isCorrect,
          order: i,
        })),
      })
    } else {
      await tx.questionFillAnswer.createMany({
        data: data.acceptedAnswers.map((a) => ({
          questionId: data.id,
          acceptedAnswer: a.answer,
          caseSensitive: a.caseSensitive,
        })),
      })
    }
  })

  revalidatePath("/admin/preguntas")
  revalidatePath(`/admin/preguntas/${existing.level.code.toLowerCase()}`)
  if (level.code !== existing.level.code) {
    revalidatePath(`/admin/preguntas/${level.code.toLowerCase()}`)
  }

  return { success: true, questionId: data.id }
}
