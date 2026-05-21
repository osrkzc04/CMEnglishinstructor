"use server"

import { revalidatePath } from "next/cache"
import { QuestionType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireRole } from "@/modules/auth/guards"
import { NewQuestionSchema, type NewQuestionInput } from "./schemas"

/**
 * Crea una pregunta nueva en el banco.
 *
 * Solo DIRECTOR / COORDINATOR. Transacción completa: insert de la pregunta
 * + opciones (MC) o respuestas aceptadas (FILL_IN). El orden de las opciones
 * se deriva del índice del array.
 */

export type CreateQuestionResult =
  | { success: true; questionId: string }
  | { success: false; error: string; field?: string }

export async function createQuestion(input: NewQuestionInput): Promise<CreateQuestionResult> {
  let currentUserId: string
  try {
    const user = await requireRole(["DIRECTOR", "COORDINATOR"])
    currentUserId = user.id
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { success: false, error: "Sin permisos para crear preguntas" }
    }
    throw err
  }

  const parsed = NewQuestionSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      success: false,
      error: first?.message ?? "Datos inválidos",
      field: first?.path.join(".") || undefined,
    }
  }
  const data = parsed.data

  const level = await prisma.cefrLevel.findUnique({
    where: { id: data.levelId },
    select: { id: true, code: true, languageId: true },
  })
  if (!level) {
    return { success: false, error: "Nivel no encontrado", field: "levelId" }
  }

  const created = await prisma.$transaction(async (tx) => {
    const question = await tx.question.create({
      data: {
        levelId: data.levelId,
        prompt: data.prompt,
        type: data.type,
        topic: data.topic ?? null,
        difficulty: data.difficulty,
        points: data.points,
        isActive: true,
        createdBy: currentUserId,
      },
      select: { id: true },
    })

    if (data.type === QuestionType.MULTIPLE_CHOICE) {
      await tx.questionOption.createMany({
        data: data.options.map((o, i) => ({
          questionId: question.id,
          text: o.text,
          isCorrect: o.isCorrect,
          order: i,
        })),
      })
    } else {
      await tx.questionFillAnswer.createMany({
        data: data.acceptedAnswers.map((a) => ({
          questionId: question.id,
          acceptedAnswer: a.answer,
          caseSensitive: a.caseSensitive,
        })),
      })
    }

    return question
  })

  revalidatePath("/admin/preguntas")
  revalidatePath(`/admin/preguntas/${level.code.toLowerCase()}`)

  return { success: true, questionId: created.id }
}
