import "server-only"

import { prisma } from "@/lib/prisma"
import { parseAcceptedAnswers, parseOptions } from "../grading/auto-grade"

/**
 * Lectura pública para `/resultados/[token]`.
 *
 * El candidato ve: nombre, plantilla, fecha de revisión, conteo total de
 * aciertos, observaciones del revisor y la lista pregunta-por-pregunta con
 * la respuesta marcada vs. la correcta. **No expone** el nivel CEFR
 * asignado, las notas R/W/L/S ni el code de sección (A1/A2/etc.) — eso
 * queda interno.
 *
 * Ventana de validez: 12 h tras `reviewedAt` (controlado por
 * `resultsTokenExpiresAt`). Si el token venció o no existe, devolvemos
 * `null` y el caller pinta la pantalla "enlace vencido".
 */

export type ResultsViewState =
  | { ok: true; data: ResultsView }
  | { ok: false; reason: "not_found" | "expired" | "not_reviewed" }

export type ResultsOption = {
  id: string
  text: string
  order: number
  isCorrect: boolean
}

export type ResultsAcceptedAnswer = {
  answer: string
  caseSensitive: boolean
}

export type ResultsQuestion = {
  id: string
  order: number
  prompt: string
  type: "MULTIPLE_CHOICE" | "FILL_IN"
  options: ResultsOption[] | null
  acceptedAnswers: ResultsAcceptedAnswer[] | null
  selectedOptionId: string | null
  textAnswer: string | null
  isCorrect: boolean | null
}

export type ResultsSkills = {
  reading: number | null
  writing: number | null
  listening: number | null
  speaking: number | null
  // Suma de las habilidades con nota (sobre 400).
  total: number
}

export type ResultsView = {
  candidateName: string
  reviewedAt: Date
  expiresAt: Date
  templateName: string
  reviewerNotes: string | null
  writingFeedback: string | null
  skills: ResultsSkills
  totalAnswered: number
  totalCorrect: number
  questions: ResultsQuestion[]
}

export async function getResultsByToken(token: string): Promise<ResultsViewState> {
  if (!token || token.length < 8) {
    return { ok: false, reason: "not_found" }
  }

  const session = await prisma.testSession.findUnique({
    where: { resultsToken: token },
    select: {
      id: true,
      status: true,
      candidateName: true,
      reviewedAt: true,
      resultsTokenExpiresAt: true,
      skillEvaluation: {
        select: {
          reading: true,
          writing: true,
          listening: true,
          speaking: true,
          reviewerNotes: true,
          writingFeedback: true,
        },
      },
      template: {
        select: { name: true },
      },
    },
  })

  if (!session) return { ok: false, reason: "not_found" }
  if (session.status !== "REVIEWED") return { ok: false, reason: "not_reviewed" }
  if (!session.reviewedAt || !session.resultsTokenExpiresAt) {
    return { ok: false, reason: "not_reviewed" }
  }
  if (session.resultsTokenExpiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" }
  }

  // Solo traemos preguntas que el candidato realmente vio/respondió. Las
  // secciones que nunca llegó a desbloquear viven en DB como snapshots sin
  // responder (con `answeredAt = null`) y mostrarlas mentiría sobre lo que
  // realmente hizo durante la evaluación.
  const rawQuestions = await prisma.testSessionQuestion.findMany({
    where: { sessionId: session.id, answeredAt: { not: null } },
    orderBy: { order: "asc" },
  })

  let totalCorrect = 0
  const questions: ResultsQuestion[] = rawQuestions.map((q) => {
    if (q.isCorrect) totalCorrect++
    const opts = parseOptions(q.optionsSnapshot)
    const accepted = parseAcceptedAnswers(q.acceptedAnswersSnapshot)
    return {
      id: q.id,
      order: q.order,
      prompt: q.promptSnapshot,
      type: q.typeSnapshot,
      options:
        opts && opts.length > 0
          ? opts.map((o) => ({
              id: o.id,
              text: o.text,
              order: o.order,
              isCorrect: o.isCorrect,
            }))
          : null,
      acceptedAnswers:
        accepted && accepted.length > 0
          ? accepted.map((a) => ({ answer: a.answer, caseSensitive: a.caseSensitive }))
          : null,
      selectedOptionId: q.selectedOptionId,
      textAnswer: q.textAnswer,
      isCorrect: q.isCorrect,
    }
  })

  const ev = session.skillEvaluation
  const reading = decimalToNumber(ev?.reading)
  const writing = decimalToNumber(ev?.writing)
  const listening = decimalToNumber(ev?.listening)
  const speaking = decimalToNumber(ev?.speaking)
  const total =
    (reading ?? 0) + (writing ?? 0) + (listening ?? 0) + (speaking ?? 0)

  return {
    ok: true,
    data: {
      candidateName: session.candidateName,
      reviewedAt: session.reviewedAt,
      expiresAt: session.resultsTokenExpiresAt,
      templateName: session.template.name,
      reviewerNotes: ev?.reviewerNotes ?? null,
      writingFeedback: ev?.writingFeedback ?? null,
      skills: { reading, writing, listening, speaking, total },
      totalAnswered: questions.length,
      totalCorrect,
      questions,
    },
  }
}

function decimalToNumber(d: unknown): number | null {
  if (d === null || d === undefined) return null
  if (typeof d === "object" && d !== null && "toNumber" in d) {
    return (d as { toNumber: () => number }).toNumber()
  }
  const n = Number(d)
  return Number.isFinite(n) ? n : null
}
