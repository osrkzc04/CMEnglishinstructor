import "server-only"

import { prisma } from "@/lib/prisma"
import { parseAcceptedAnswers, parseOptions } from "../grading/auto-grade"
import type { AcceptedAnswerSnapshot, OptionSnapshot, SectionGradeResult } from "../shared/types"

/**
 * Lecturas server-only para la pantalla admin de revisión `/admin/pruebas/[id]`.
 *
 * Devuelve la sesión completa con todas las preguntas, sus snapshots, la
 * respuesta del candidato y el estado de calificación. A diferencia de
 * `getSessionStateById` (público), acá SÍ exponemos `isCorrect` por opción
 * porque es vista interna.
 *
 * También incluye eventos sospechosos (focus_lost, copy/paste, device mismatch)
 * y la evaluación R/W/L/S si ya existe.
 */

export type ReviewOption = {
  id: string
  text: string
  order: number
  isCorrect: boolean
}

export type ReviewAcceptedAnswer = {
  answer: string
  caseSensitive: boolean
}

export type ReviewQuestion = {
  id: string
  order: number
  sectionOrder: number | null
  cefrLevelCode: string | null
  prompt: string
  type: "MULTIPLE_CHOICE" | "FILL_IN"
  points: number
  options: ReviewOption[] | null
  acceptedAnswers: ReviewAcceptedAnswer[] | null
  selectedOptionId: string | null
  textAnswer: string | null
  answeredAt: Date | null
  markedForReview: boolean
  isCorrect: boolean | null
  pointsAwarded: number | null
  reviewerComment: string | null
}

export type ReviewSectionSummary = SectionGradeResult & {
  passingPercent: number
}

export type ReviewEvent = {
  id: string
  type: string
  occurredAt: Date
  metadata: unknown
}

export type ReviewDetail = {
  session: {
    id: string
    candidateName: string
    candidateEmail: string
    candidatePhone: string | null
    candidateDocument: string | null
    status: "IN_PROGRESS" | "SUBMITTED" | "TIMED_OUT" | "REVIEWED" | "ABANDONED"
    startedAt: Date
    deadline: Date
    submittedAt: Date | null
    reviewedAt: Date | null
    reviewerNotes: string | null
    autoScore: number | null
    maxAutoScore: number | null
    resultsToken: string | null
    resultsTokenExpiresAt: Date | null
    template: {
      id: string
      name: string
      timeLimitMinutes: number
    }
  }
  skillEvaluation: {
    reading: number | null
    writing: number | null
    listening: number | null
    speaking: number | null
    assignedLevelId: string | null
    reviewerNotes: string | null
  } | null
  questions: ReviewQuestion[]
  sectionSummaries: ReviewSectionSummary[]
  events: ReviewEvent[]
  cefrLevels: { id: string; code: string; name: string; order: number }[]
}

export async function getReviewDetail(sessionId: string): Promise<ReviewDetail | null> {
  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      candidateName: true,
      candidateEmail: true,
      status: true,
      startedAt: true,
      deadline: true,
      submittedAt: true,
      reviewedAt: true,
      reviewerNotes: true,
      autoScore: true,
      maxAutoScore: true,
      resultsToken: true,
      resultsTokenExpiresAt: true,
      invite: {
        select: {
          candidatePhone: true,
          candidateDocument: true,
        },
      },
      template: {
        select: { id: true, name: true, timeLimitMinutes: true, languageId: true },
      },
      skillEvaluation: {
        select: {
          reading: true,
          writing: true,
          listening: true,
          speaking: true,
          assignedLevelId: true,
          reviewerNotes: true,
        },
      },
    },
  })
  if (!session) return null

  const [rawQuestions, rawEvents, rawSections, cefrLevels] = await prisma.$transaction([
    prisma.testSessionQuestion.findMany({
      where: { sessionId },
      orderBy: { order: "asc" },
    }),
    prisma.testSessionEvent.findMany({
      where: { sessionId },
      orderBy: { occurredAt: "asc" },
      select: { id: true, type: true, occurredAt: true, metadata: true },
    }),
    prisma.testTemplateSection.findMany({
      where: { templateId: session.template.id },
      orderBy: { order: "asc" },
      select: {
        order: true,
        passingPercent: true,
        questionCount: true,
        level: { select: { code: true } },
      },
    }),
    prisma.cefrLevel.findMany({
      where: { languageId: session.template.languageId },
      orderBy: { order: "asc" },
      select: { id: true, code: true, name: true, order: true },
    }),
  ])

  const questions: ReviewQuestion[] = rawQuestions.map((q) => {
    const opts = parseOptions(q.optionsSnapshot)
    const accepted = parseAcceptedAnswers(q.acceptedAnswersSnapshot)
    return {
      id: q.id,
      order: q.order,
      sectionOrder: q.sectionOrder,
      cefrLevelCode: q.cefrLevelCode,
      prompt: q.promptSnapshot,
      type: q.typeSnapshot,
      points: q.pointsSnapshot,
      options: mapOptions(opts),
      acceptedAnswers: mapAccepted(accepted),
      selectedOptionId: q.selectedOptionId,
      textAnswer: q.textAnswer,
      answeredAt: q.answeredAt,
      markedForReview: q.markedForReview,
      isCorrect: q.isCorrect,
      pointsAwarded: q.pointsAwarded,
      reviewerComment: q.reviewerComment,
    }
  })

  // Resumen por sección — agregamos contra los `isCorrect` ya persistidos. Si
  // alguno está null (revisión humana pendiente) lo contamos como incorrecto
  // para el % auto. Es solo un indicador, no afecta la nota humana.
  const sectionBuckets = new Map<
    number,
    { total: number; correct: number; cefrLevelCode: string }
  >()
  for (const q of questions) {
    if (q.sectionOrder === null || q.cefrLevelCode === null) continue
    const bucket = sectionBuckets.get(q.sectionOrder) ?? {
      total: 0,
      correct: 0,
      cefrLevelCode: q.cefrLevelCode,
    }
    bucket.total += 1
    if (q.isCorrect === true) bucket.correct += 1
    sectionBuckets.set(q.sectionOrder, bucket)
  }
  const sectionSummaries: ReviewSectionSummary[] = rawSections.map((s) => {
    const b = sectionBuckets.get(s.order)
    const total = b?.total ?? 0
    const correct = b?.correct ?? 0
    return {
      sectionOrder: s.order,
      cefrLevelCode: b?.cefrLevelCode ?? s.level.code,
      totalQuestions: total,
      correctAnswers: correct,
      scorePercent: total === 0 ? 0 : Math.round((correct / total) * 100),
      passedThreshold: total === 0 ? false : (correct / total) * 100 >= s.passingPercent,
      passingPercent: s.passingPercent,
    }
  })

  return {
    session: {
      id: session.id,
      candidateName: session.candidateName,
      candidateEmail: session.candidateEmail,
      candidatePhone: session.invite.candidatePhone,
      candidateDocument: session.invite.candidateDocument,
      status: session.status,
      startedAt: session.startedAt,
      deadline: session.deadline,
      submittedAt: session.submittedAt,
      reviewedAt: session.reviewedAt,
      reviewerNotes: session.reviewerNotes,
      autoScore: session.autoScore,
      maxAutoScore: session.maxAutoScore,
      resultsToken: session.resultsToken,
      resultsTokenExpiresAt: session.resultsTokenExpiresAt,
      template: {
        id: session.template.id,
        name: session.template.name,
        timeLimitMinutes: session.template.timeLimitMinutes,
      },
    },
    skillEvaluation: session.skillEvaluation
      ? {
          reading: decimalToNumber(session.skillEvaluation.reading),
          writing: decimalToNumber(session.skillEvaluation.writing),
          listening: decimalToNumber(session.skillEvaluation.listening),
          speaking: decimalToNumber(session.skillEvaluation.speaking),
          assignedLevelId: session.skillEvaluation.assignedLevelId,
          reviewerNotes: session.skillEvaluation.reviewerNotes,
        }
      : null,
    questions,
    sectionSummaries,
    events: rawEvents.map((e) => ({
      id: e.id,
      type: e.type,
      occurredAt: e.occurredAt,
      metadata: e.metadata,
    })),
    cefrLevels,
  }
}

function mapOptions(options: OptionSnapshot[] | null): ReviewOption[] | null {
  if (!options) return null
  return options
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((o) => ({ id: o.id, text: o.text, order: o.order, isCorrect: o.isCorrect }))
}

function mapAccepted(accepted: AcceptedAnswerSnapshot[] | null): ReviewAcceptedAnswer[] | null {
  if (!accepted) return null
  return accepted.map((a) => ({ answer: a.answer, caseSensitive: a.caseSensitive }))
}

function decimalToNumber(d: unknown): number | null {
  if (d === null || d === undefined) return null
  // Prisma Decimal expone toNumber()
  if (typeof d === "object" && d !== null && "toNumber" in d) {
    return (d as { toNumber: () => number }).toNumber()
  }
  const n = Number(d)
  return Number.isFinite(n) ? n : null
}
