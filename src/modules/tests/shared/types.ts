import type { CefrLevel, TestSession, TestSessionQuestion } from "@prisma/client"

/**
 * Tipos compartidos del motor de exámenes.
 *
 * Se mantiene aparte de schemas Zod porque acá viven los shapes derivados
 * de Prisma (server-side only) y aliases narrow para los snapshots.
 */

// -----------------------------------------------------------------------------
//  Snapshots inmutables de pregunta — la forma que vive en `optionsSnapshot`
//  y `acceptedAnswersSnapshot` (Json en DB).
// -----------------------------------------------------------------------------

export type OptionSnapshot = {
  id: string
  text: string
  isCorrect: boolean
  order: number
}

export type AcceptedAnswerSnapshot = {
  answer: string
  caseSensitive: boolean
}

// -----------------------------------------------------------------------------
//  Estado de avance del placement adaptativo
// -----------------------------------------------------------------------------

export type SectionProgress = {
  order: number
  cefrLevelCode: string
  totalQuestions: number
  answeredQuestions: number
  isUnlocked: boolean
  isCurrent: boolean
  // Después del commit por sección quedamos con un score concreto. Antes del
  // commit es null — la UI no debería mostrar nota intermedia al candidato.
  scorePercent: number | null
  passedThreshold: boolean | null
}

export type SessionSnapshot = {
  sessionId: string
  status: TestSession["status"]
  currentSectionOrder: number
  deadlineISO: string
  remainingMs: number
  sections: SectionProgress[]
}

// -----------------------------------------------------------------------------
//  Eventos sospechosos: rate-limited en el endpoint, pero el tipo lo usa la UI.
// -----------------------------------------------------------------------------

export type ClientReportableEvent =
  | "FOCUS_LOST"
  | "FOCUS_REGAINED"
  | "FULLSCREEN_EXIT"
  | "COPY_ATTEMPT"
  | "PASTE_ATTEMPT"
  | "QUESTION_VIEWED"

// -----------------------------------------------------------------------------
//  Resultado de auto-grade — pura, no toca Prisma directamente.
// -----------------------------------------------------------------------------

export type GradedQuestion = {
  questionRowId: string
  isCorrect: boolean | null
  points: number
}

export type SectionGradeResult = {
  sectionOrder: number
  cefrLevelCode: string
  totalQuestions: number
  correctAnswers: number
  scorePercent: number
  passedThreshold: boolean
}

export type GradeResult = {
  autoScore: number
  maxAutoScore: number
  gradedQuestions: GradedQuestion[]
  sectionResults: SectionGradeResult[]
}

// -----------------------------------------------------------------------------
//  Helpers de tipos derivados de Prisma — útiles para firmas internas
// -----------------------------------------------------------------------------

export type CefrLevelLite = Pick<CefrLevel, "id" | "code" | "name" | "order">

export type SessionQuestionWithGrading = TestSessionQuestion

export type Section = {
  order: number
  levelId: string
  cefrLevelCode: string
  samplePoolSize: number
  questionCount: number
  passingPercent: number
}
