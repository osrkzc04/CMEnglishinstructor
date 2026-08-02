"use server"

import { revalidatePath } from "next/cache"
import { QuestionType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireRole } from "@/modules/auth/guards"
import { validateImport } from "./import"

/**
 * Action de commit del importador. Re-parsea el CSV (no confiamos en el
 * cliente para validación) y solo inserta las filas con estado `ok`.
 *
 * Skip silencioso: las filas `dup` y `error` se descartan y se reportan en
 * los contadores del resultado. La política es "agregar nuevas only" — no
 * tocamos preguntas existentes ni siquiera por upsert.
 *
 * Persistencia: una transacción por bloque de 20 inserts con timeout
 * explícito de 60 s. El default de Prisma (5 s) se queda corto cuando el
 * round-trip bajo carga suma varios cientos de ms, y la transacción muere a
 * mitad de camino con "Transaction not found".
 */

const MAX_CSV_BYTES = 200_000
const CHUNK_SIZE = 20
const TX_TIMEOUT_MS = 60_000
const TX_MAX_WAIT_MS = 10_000

export type CommitImportResult =
  | {
      success: true
      created: number
      skippedDuplicates: number
      skippedErrors: number
    }
  | { success: false; error: string }

export async function commitImport(input: {
  csvText: string
  levelId: string
}): Promise<CommitImportResult> {
  let currentUserId: string
  try {
    const user = await requireRole(["DIRECTOR", "COORDINATOR"])
    currentUserId = user.id
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { success: false, error: "Sin permisos para importar preguntas" }
    }
    throw err
  }

  if (typeof input.csvText !== "string" || input.csvText.length === 0) {
    return { success: false, error: "El archivo está vacío" }
  }
  if (input.csvText.length > MAX_CSV_BYTES) {
    return {
      success: false,
      error: `El archivo supera el límite de ${Math.round(MAX_CSV_BYTES / 1000)} KB`,
    }
  }

  const level = await prisma.cefrLevel.findUnique({
    where: { id: input.levelId },
    select: { id: true, code: true },
  })
  if (!level) {
    return { success: false, error: "Nivel no encontrado" }
  }

  const existing = await prisma.question.findMany({
    where: { levelId: input.levelId },
    select: { prompt: true },
  })
  const existingPromptsLowercased = new Set(existing.map((q) => q.prompt.trim().toLowerCase()))

  const summary = validateImport(input.csvText, {
    levelCode: level.code,
    existingPromptsLowercased,
  })

  if (summary.parseError) {
    return { success: false, error: summary.parseError }
  }

  const okPayloads = summary.rows
    .filter((r) => r.status === "ok" && r.payload)
    .map((r) => r.payload!)

  if (okPayloads.length === 0) {
    return {
      success: true,
      created: 0,
      skippedDuplicates: summary.duplicates,
      skippedErrors: summary.errors,
    }
  }

  let created = 0
  for (let start = 0; start < okPayloads.length; start += CHUNK_SIZE) {
    const chunk = okPayloads.slice(start, start + CHUNK_SIZE)
    await prisma.$transaction(
      async (tx) => {
        for (const payload of chunk) {
          if (payload.kind === "mc") {
            const q = await tx.question.create({
              data: {
                levelId: level.id,
                prompt: payload.prompt,
                type: QuestionType.MULTIPLE_CHOICE,
                topic: payload.topic,
                points: payload.points,
                isActive: true,
                createdBy: currentUserId,
              },
              select: { id: true },
            })
            await tx.questionOption.createMany({
              data: payload.options.map((o, i) => ({
                questionId: q.id,
                text: o.text,
                isCorrect: o.isCorrect,
                order: i,
              })),
            })
          } else {
            const q = await tx.question.create({
              data: {
                levelId: level.id,
                prompt: payload.prompt,
                type: QuestionType.FILL_IN,
                topic: payload.topic,
                points: payload.points,
                isActive: true,
                createdBy: currentUserId,
              },
              select: { id: true },
            })
            await tx.questionFillAnswer.createMany({
              data: payload.acceptedAnswers.map((a) => ({
                questionId: q.id,
                acceptedAnswer: a.answer,
                caseSensitive: a.caseSensitive,
              })),
            })
          }
          created += 1
        }
      },
      { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS },
    )
  }

  revalidatePath("/admin/preguntas")
  revalidatePath(`/admin/preguntas/${level.code.toLowerCase()}`)

  return {
    success: true,
    created,
    skippedDuplicates: summary.duplicates,
    skippedErrors: summary.errors,
  }
}
