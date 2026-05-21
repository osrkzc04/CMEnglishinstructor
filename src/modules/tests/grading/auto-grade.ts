import type { TestSessionQuestion } from "@prisma/client"

import type {
  AcceptedAnswerSnapshot,
  GradeResult,
  GradedQuestion,
  OptionSnapshot,
  SectionGradeResult,
} from "../shared/types"

/**
 * Auto-grade — función pura. NO toca Prisma.
 *
 * Recibe TestSessionQuestion ya snapshotadas y devuelve resultado agregado +
 * detalle por pregunta. Trabaja contra `optionsSnapshot` / `acceptedAnswersSnapshot`
 * (no contra el banco vivo) para mantener inmutabilidad por intento.
 *
 * Reglas:
 *  - MULTIPLE_CHOICE: si `selectedOptionId` coincide con la opción marcada
 *    `isCorrect: true` en el snapshot → correcta. Si no respondió o no
 *    coincide → incorrecta. Si el snapshot no tiene ninguna opción correcta
 *    (caso defensivo, no debería ocurrir) → null (revisión manual).
 *  - FILL_IN: compara `textAnswer` con `acceptedAnswersSnapshot`. Trim por
 *    defecto. `caseSensitive: true` exige match exacto; default es
 *    case-insensitive. Si ninguna respuesta aceptada matchea → null
 *    (revisión manual, NO incorrecta automática).
 *
 * Agregados por sección: para cada `sectionOrder` único, devuelve
 * `correctAnswers / totalQuestions = scorePercent`. El umbral lo decide el
 * caller (advance-section lee `TestTemplateSection.passingPercent`).
 */
export function autoGrade(questions: TestSessionQuestion[]): GradeResult {
  const gradedQuestions: GradedQuestion[] = []
  let autoScore = 0
  let maxAutoScore = 0

  // Agrupador por sección — solo se popula si la pregunta tiene sectionOrder.
  const sectionAccumulator = new Map<number, { code: string; total: number; correct: number }>()

  for (const q of questions) {
    maxAutoScore += q.pointsSnapshot

    const result = gradeOne(q)
    gradedQuestions.push({
      questionRowId: q.id,
      isCorrect: result.isCorrect,
      points: result.points,
    })

    if (result.isCorrect === true) {
      autoScore += result.points
    }

    if (q.sectionOrder !== null && q.cefrLevelCode !== null) {
      const bucket = sectionAccumulator.get(q.sectionOrder) ?? {
        code: q.cefrLevelCode,
        total: 0,
        correct: 0,
      }
      bucket.total += 1
      if (result.isCorrect === true) bucket.correct += 1
      sectionAccumulator.set(q.sectionOrder, bucket)
    }
  }

  const sectionResults: SectionGradeResult[] = Array.from(sectionAccumulator.entries())
    .sort(([a], [b]) => a - b)
    .map(([order, b]) => ({
      sectionOrder: order,
      cefrLevelCode: b.code,
      totalQuestions: b.total,
      correctAnswers: b.correct,
      scorePercent: b.total === 0 ? 0 : Math.round((b.correct / b.total) * 100),
      // El umbral lo evalúa el caller, no acá — `false` es placeholder seguro.
      passedThreshold: false,
    }))

  return { autoScore, maxAutoScore, gradedQuestions, sectionResults }
}

// -----------------------------------------------------------------------------
//  Grader por pregunta
// -----------------------------------------------------------------------------

function gradeOne(q: TestSessionQuestion): { isCorrect: boolean | null; points: number } {
  if (q.typeSnapshot === "MULTIPLE_CHOICE") {
    return gradeMultipleChoice(q)
  }
  if (q.typeSnapshot === "FILL_IN") {
    return gradeFillIn(q)
  }
  return { isCorrect: null, points: 0 }
}

function gradeMultipleChoice(q: TestSessionQuestion): {
  isCorrect: boolean | null
  points: number
} {
  const options = parseOptions(q.optionsSnapshot)
  if (!options || options.length === 0) {
    return { isCorrect: null, points: 0 }
  }
  const correct = options.find((o) => o.isCorrect)
  if (!correct) {
    // Sin respuesta correcta definida — flagrante error de banco. Marca null
    // para que la revisión humana lo detecte; no asignamos 0 automáticamente.
    return { isCorrect: null, points: 0 }
  }
  if (!q.selectedOptionId) {
    return { isCorrect: false, points: 0 }
  }
  if (q.selectedOptionId === correct.id) {
    return { isCorrect: true, points: q.pointsSnapshot }
  }
  return { isCorrect: false, points: 0 }
}

function gradeFillIn(q: TestSessionQuestion): { isCorrect: boolean | null; points: number } {
  const accepted = parseAcceptedAnswers(q.acceptedAnswersSnapshot)
  if (!accepted || accepted.length === 0) {
    return { isCorrect: null, points: 0 }
  }
  const provided = (q.textAnswer ?? "").trim()
  if (provided.length === 0) {
    return { isCorrect: false, points: 0 }
  }
  for (const candidate of accepted) {
    const expected = candidate.answer.trim()
    if (candidate.caseSensitive) {
      if (provided === expected) return { isCorrect: true, points: q.pointsSnapshot }
    } else {
      if (provided.toLowerCase() === expected.toLowerCase()) {
        return { isCorrect: true, points: q.pointsSnapshot }
      }
    }
  }
  // Texto distinto a todas las aceptadas: lo dejamos `null` para que la
  // directora pueda revisar manualmente; podría ser una respuesta válida
  // que no estaba contemplada en el banco.
  return { isCorrect: null, points: 0 }
}

// -----------------------------------------------------------------------------
//  Helpers para casteo de los Json fields a tipos tipados.
// -----------------------------------------------------------------------------

export function parseOptions(value: unknown): OptionSnapshot[] | null {
  if (!Array.isArray(value)) return null
  return value as OptionSnapshot[]
}

export function parseAcceptedAnswers(value: unknown): AcceptedAnswerSnapshot[] | null {
  if (!Array.isArray(value)) return null
  return value as AcceptedAnswerSnapshot[]
}
