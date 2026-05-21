import "server-only"
import { prisma } from "@/lib/prisma"
import type { OptionSnapshot } from "../shared/types"
import { parseOptions } from "../grading/auto-grade"

/**
 * Lecturas server-only para la pantalla de rendición y para los route
 * handlers que devuelven estado al cliente.
 *
 * Solo expone preguntas de la sección actualmente desbloqueada — nunca
 * devolvemos las de secciones futuras al cliente, aunque ya estén
 * snapshotadas en DB.
 */

export type VisibleQuestion = {
  order: number
  prompt: string
  type: "MULTIPLE_CHOICE" | "FILL_IN"
  // Para MC: opciones sin `isCorrect` (no se filtra desde el cliente cuál es).
  options: { id: string; text: string; order: number }[] | null
  selectedOptionId: string | null
  textAnswer: string | null
  markedForReview: boolean
}

export type SectionMeta = {
  order: number
  isUnlocked: boolean
  isCurrent: boolean
  totalQuestions: number
  answeredQuestions: number
  // Rango [start, end] de número de tarjeta que ocupa la sección — solo se
  // setea para las secciones desbloqueadas; las bloqueadas devuelven null
  // para no filtrar tamaño total al cliente.
  cardRange: { start: number; end: number } | null
}

export type SessionState = {
  sessionId: string
  status: "IN_PROGRESS" | "SUBMITTED" | "TIMED_OUT" | "REVIEWED" | "ABANDONED"
  candidateName: string
  deadlineISO: string
  remainingMs: number
  currentSectionOrder: number
  visibleQuestions: VisibleQuestion[]
  sections: SectionMeta[]
}

export async function getSessionStateById(sessionId: string): Promise<SessionState | null> {
  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      candidateName: true,
      deadline: true,
      currentSectionOrder: true,
      templateId: true,
    },
  })
  if (!session) return null

  const [sections, questions] = await prisma.$transaction([
    prisma.testTemplateSection.findMany({
      where: { templateId: session.templateId },
      orderBy: { order: "asc" },
      select: { order: true, questionCount: true },
    }),
    prisma.testSessionQuestion.findMany({
      where: { sessionId: session.id, sectionOrder: { not: null } },
      orderBy: { order: "asc" },
      select: {
        order: true,
        sectionOrder: true,
        promptSnapshot: true,
        typeSnapshot: true,
        optionsSnapshot: true,
        selectedOptionId: true,
        textAnswer: true,
        markedForReview: true,
      },
    }),
  ])

  // Mapear secciones con rango de tarjetas. Las desbloqueadas son aquellas
  // con order <= currentSectionOrder. Solo esas exponen su rango (para que
  // el cliente sepa qué números mostrar). El total tampoco se filtra.
  let cursor = 1
  const sectionMetas: SectionMeta[] = []
  for (const s of sections) {
    const isUnlocked = s.order <= session.currentSectionOrder
    const totalQuestions = s.questionCount
    let answeredQuestions = 0
    if (isUnlocked) {
      answeredQuestions = questions.filter(
        (q) =>
          q.sectionOrder === s.order &&
          (q.typeSnapshot === "MULTIPLE_CHOICE"
            ? q.selectedOptionId !== null
            : q.textAnswer !== null && q.textAnswer.trim().length > 0),
      ).length
    }
    sectionMetas.push({
      order: s.order,
      isUnlocked,
      isCurrent: s.order === session.currentSectionOrder,
      totalQuestions,
      answeredQuestions,
      cardRange: isUnlocked ? { start: cursor, end: cursor + totalQuestions - 1 } : null,
    })
    cursor += totalQuestions
  }

  const visibleQuestions: VisibleQuestion[] = questions
    .filter((q) => q.sectionOrder === session.currentSectionOrder)
    .map((q) => ({
      order: q.order,
      prompt: q.promptSnapshot,
      type: q.typeSnapshot,
      options:
        q.typeSnapshot === "MULTIPLE_CHOICE"
          ? maskCorrectness(parseOptions(q.optionsSnapshot))
          : null,
      selectedOptionId: q.selectedOptionId,
      textAnswer: q.textAnswer,
      markedForReview: q.markedForReview,
    }))

  const now = Date.now()
  return {
    sessionId: session.id,
    status: session.status,
    candidateName: session.candidateName,
    deadlineISO: session.deadline.toISOString(),
    remainingMs: Math.max(0, session.deadline.getTime() - now),
    currentSectionOrder: session.currentSectionOrder,
    visibleQuestions,
    sections: sectionMetas,
  }
}

function maskCorrectness(
  options: OptionSnapshot[] | null,
): { id: string; text: string; order: number }[] | null {
  if (!options) return null
  return options
    .sort((a, b) => a.order - b.order)
    .map((o) => ({ id: o.id, text: o.text, order: o.order }))
}
