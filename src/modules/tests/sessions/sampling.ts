import { Prisma, type QuestionType } from "@prisma/client"

import type { Section } from "../shared/types"

/**
 * Sorteo de preguntas para un placement test multi-sección.
 *
 * Aleatoriedad delegada a Postgres (`random()`) — las queries corren dentro
 * de la transacción del caller para que el sorteo y el snapshot vivan en el
 * mismo commit.
 *
 * Garantiza:
 *  - Por cada sección, exactamente `questionCount` preguntas activas del
 *    nivel correcto.
 *  - **De esas, idealmente 1 es de comprensión lectora** (convención:
 *    `topic ILIKE 'reading'`). Si el banco del nivel no tiene readings, se
 *    completa con `questionCount` preguntas no-reading (fallback silencioso
 *    para no romper el examen). El `missingReadingLevels[]` que devuelve la
 *    función permite al caller registrar el evento.
 *  - Sin solapamiento entre secciones (cada pregunta vive en un solo nivel
 *    por `Question.levelId`).
 *  - Orden general: A1 primero, A2 después, etc. según `section.order`.
 *
 * Si una sección no llega a `questionCount` ni siquiera sumando readings y
 * no-readings, se lanza `InsufficientQuestionsError` con detalles — coordinación
 * debe saber que el banco está incompleto antes de invitar candidatos.
 */

export type SampledQuestion = {
  questionId: string
  sectionOrder: number
  cefrLevelCode: string
  prompt: string
  type: QuestionType
  points: number
  options: { id: string; text: string; isCorrect: boolean; order: number }[] | null
  acceptedAnswers: { answer: string; caseSensitive: boolean }[] | null
}

export class InsufficientQuestionsError extends Error {
  constructor(
    public readonly cefrLevelCode: string,
    public readonly required: number,
    public readonly available: number,
  ) {
    super(
      `Banco insuficiente en nivel ${cefrLevelCode}: se requieren ${required} preguntas activas, hay ${available}`,
    )
    this.name = "InsufficientQuestionsError"
  }
}

type RawQuestion = {
  id: string
  prompt: string
  type: QuestionType
  points: number
}

type RawOption = {
  id: string
  questionId: string
  text: string
  isCorrect: boolean
  order: number
}

type RawFillAnswer = {
  questionId: string
  acceptedAnswer: string
  caseSensitive: boolean
}

export type SamplingResult = {
  questions: SampledQuestion[]
  // Niveles donde no había ni un reading en el banco; el caller los registra
  // como evento `MISSING_READING` para que coordinación los detecte.
  missingReadingLevels: string[]
}

export async function sampleQuestionsForPlacement(
  tx: Prisma.TransactionClient,
  sections: Section[],
): Promise<SamplingResult> {
  const ordered = [...sections].sort((a, b) => a.order - b.order)
  const all: SampledQuestion[] = []
  const missingReadingLevels: string[] = []

  for (const section of ordered) {
    // ORDER BY random() es O(n) en Postgres — aceptable para banco de 50-200
    // por nivel. Si el banco crece a miles, conviene migrar a `TABLESAMPLE`
    // o muestreo por id pre-calculado.
    //
    // Hacemos DOS queries: una para garantizar 1 reading (topic ILIKE
    // 'reading') y otra para completar con el resto. Si no hay readings,
    // la primera devuelve 0 filas y la segunda compensa con questionCount
    // completo del pool no-reading.
    const readingRows = await tx.$queryRaw<RawQuestion[]>`
      SELECT "id", "prompt", "type", "points"
      FROM "Question"
      WHERE "levelId" = ${section.levelId}
        AND "isActive" = true
        AND "topic" ILIKE 'reading'
      ORDER BY random()
      LIMIT 1
    `

    if (readingRows.length === 0) {
      missingReadingLevels.push(section.cefrLevelCode)
    }

    const remaining = section.questionCount - readingRows.length
    const restRows =
      remaining > 0
        ? await tx.$queryRaw<RawQuestion[]>`
            SELECT "id", "prompt", "type", "points"
            FROM "Question"
            WHERE "levelId" = ${section.levelId}
              AND "isActive" = true
              AND ("topic" IS NULL OR "topic" NOT ILIKE 'reading')
            ORDER BY random()
            LIMIT ${remaining}
          `
        : []

    const rows = [...readingRows, ...restRows]

    if (rows.length < section.questionCount) {
      throw new InsufficientQuestionsError(
        section.cefrLevelCode,
        section.questionCount,
        rows.length,
      )
    }

    // Shuffle ligero para que el reading no caiga siempre en la misma
    // posición del bloque. Fisher-Yates clásico.
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const a = rows[i]!
      const b = rows[j]!
      rows[i] = b
      rows[j] = a
    }

    const ids = rows.map((r) => r.id)
    const [options, fillAnswers] = await Promise.all([
      tx.questionOption.findMany({
        where: { questionId: { in: ids } },
        orderBy: [{ questionId: "asc" }, { order: "asc" }],
        select: { id: true, questionId: true, text: true, isCorrect: true, order: true },
      }) as Promise<RawOption[]>,
      tx.questionFillAnswer.findMany({
        where: { questionId: { in: ids } },
        select: { questionId: true, acceptedAnswer: true, caseSensitive: true },
      }) as Promise<RawFillAnswer[]>,
    ])

    const optionsByQ = new Map<string, RawOption[]>()
    for (const o of options) {
      const bucket = optionsByQ.get(o.questionId) ?? []
      bucket.push(o)
      optionsByQ.set(o.questionId, bucket)
    }
    const answersByQ = new Map<string, RawFillAnswer[]>()
    for (const a of fillAnswers) {
      const bucket = answersByQ.get(a.questionId) ?? []
      bucket.push(a)
      answersByQ.set(a.questionId, bucket)
    }

    for (const row of rows) {
      const opts = optionsByQ.get(row.id) ?? []
      const ans = answersByQ.get(row.id) ?? []
      all.push({
        questionId: row.id,
        sectionOrder: section.order,
        cefrLevelCode: section.cefrLevelCode,
        prompt: row.prompt,
        type: row.type,
        points: row.points,
        options:
          row.type === "MULTIPLE_CHOICE"
            ? opts.map((o) => ({
                id: o.id,
                text: o.text,
                isCorrect: o.isCorrect,
                order: o.order,
              }))
            : null,
        acceptedAnswers:
          row.type === "FILL_IN"
            ? ans.map((a) => ({ answer: a.acceptedAnswer, caseSensitive: a.caseSensitive }))
            : null,
      })
    }
  }

  return { questions: all, missingReadingLevels }
}
