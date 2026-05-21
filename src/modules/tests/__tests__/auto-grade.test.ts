import { describe, it, expect } from "vitest"
import type { TestSessionQuestion } from "@prisma/client"

import { autoGrade } from "../grading/auto-grade"

/**
 * Tests para `autoGrade` (función pura). No tocan Prisma — los `TestSessionQuestion`
 * los construimos a mano respetando la forma del modelo.
 *
 * Casos a cubrir:
 *  - MC: correcta, incorrecta, sin responder, snapshot defectuoso (sin opción
 *    marcada isCorrect).
 *  - FILL_IN: match exacto, case-insensitive, sensible a mayúsculas, sin match
 *    (queda null para revisión humana), sin aceptadas.
 *  - Agregación por sección: sumar correctas/total por sectionOrder.
 *  - autoScore / maxAutoScore acumulan correctamente.
 */

function mcQuestion(overrides: {
  id?: string
  order?: number
  sectionOrder?: number | null
  cefrLevelCode?: string | null
  points?: number
  options: { id: string; text: string; isCorrect: boolean; order: number }[]
  selectedOptionId?: string | null
}): TestSessionQuestion {
  return {
    id: overrides.id ?? "q-mc",
    sessionId: "session-1",
    order: overrides.order ?? 1,
    questionId: "src-q",
    promptSnapshot: "prompt",
    typeSnapshot: "MULTIPLE_CHOICE",
    pointsSnapshot: overrides.points ?? 1,
    optionsSnapshot: overrides.options as unknown as TestSessionQuestion["optionsSnapshot"],
    acceptedAnswersSnapshot: null,
    cefrLevelCode: "cefrLevelCode" in overrides ? (overrides.cefrLevelCode ?? null) : "A1",
    sectionOrder: "sectionOrder" in overrides ? (overrides.sectionOrder ?? null) : 1,
    selectedOptionId: overrides.selectedOptionId ?? null,
    textAnswer: null,
    answeredAt: null,
    markedForReview: false,
    isCorrect: null,
    pointsAwarded: null,
    reviewerComment: null,
  }
}

function fillQuestion(overrides: {
  id?: string
  order?: number
  sectionOrder?: number | null
  cefrLevelCode?: string | null
  points?: number
  acceptedAnswers: { answer: string; caseSensitive: boolean }[]
  textAnswer?: string | null
}): TestSessionQuestion {
  return {
    id: overrides.id ?? "q-fill",
    sessionId: "session-1",
    order: overrides.order ?? 1,
    questionId: "src-q",
    promptSnapshot: "prompt",
    typeSnapshot: "FILL_IN",
    pointsSnapshot: overrides.points ?? 1,
    optionsSnapshot: null,
    acceptedAnswersSnapshot:
      overrides.acceptedAnswers as unknown as TestSessionQuestion["acceptedAnswersSnapshot"],
    cefrLevelCode: overrides.cefrLevelCode ?? "B1",
    sectionOrder: overrides.sectionOrder ?? 2,
    selectedOptionId: null,
    textAnswer: overrides.textAnswer ?? null,
    answeredAt: null,
    markedForReview: false,
    isCorrect: null,
    pointsAwarded: null,
    reviewerComment: null,
  }
}

describe("autoGrade — MULTIPLE_CHOICE", () => {
  const options = [
    { id: "o1", text: "wrong", isCorrect: false, order: 0 },
    { id: "o2", text: "correct", isCorrect: true, order: 1 },
    { id: "o3", text: "wrong", isCorrect: false, order: 2 },
  ]

  it("marca correcta cuando el seleccionado matchea la opción isCorrect", () => {
    const result = autoGrade([mcQuestion({ options, selectedOptionId: "o2", points: 1 })])
    expect(result.autoScore).toBe(1)
    expect(result.maxAutoScore).toBe(1)
    expect(result.gradedQuestions[0]).toMatchObject({ isCorrect: true, points: 1 })
  })

  it("marca incorrecta cuando el seleccionado no matchea", () => {
    const result = autoGrade([mcQuestion({ options, selectedOptionId: "o1", points: 1 })])
    expect(result.autoScore).toBe(0)
    expect(result.maxAutoScore).toBe(1)
    expect(result.gradedQuestions[0]).toMatchObject({ isCorrect: false, points: 0 })
  })

  it("marca incorrecta cuando no respondió", () => {
    const result = autoGrade([mcQuestion({ options, selectedOptionId: null, points: 1 })])
    expect(result.gradedQuestions[0]).toMatchObject({ isCorrect: false, points: 0 })
  })

  it("marca null cuando el snapshot no tiene ninguna opción correcta (banco roto)", () => {
    const broken = [
      { id: "o1", text: "x", isCorrect: false, order: 0 },
      { id: "o2", text: "y", isCorrect: false, order: 1 },
    ]
    const result = autoGrade([mcQuestion({ options: broken, selectedOptionId: "o1", points: 1 })])
    expect(result.gradedQuestions[0]).toMatchObject({ isCorrect: null, points: 0 })
    expect(result.autoScore).toBe(0)
    // maxAutoScore sigue contando: una pregunta rota no debería inflar el
    // techo, pero tampoco castigar al candidato hasta que la revisión la
    // resuelva. autoGrade es defensivo: suma puntos al techo siempre.
    expect(result.maxAutoScore).toBe(1)
  })
})

describe("autoGrade — FILL_IN", () => {
  it("acepta match case-insensitive por default", () => {
    const result = autoGrade([
      fillQuestion({
        acceptedAnswers: [{ answer: "Hello", caseSensitive: false }],
        textAnswer: "  HELLO  ",
      }),
    ])
    expect(result.gradedQuestions[0]).toMatchObject({ isCorrect: true, points: 1 })
  })

  it("respeta caseSensitive=true para exigir match exacto", () => {
    const result = autoGrade([
      fillQuestion({
        acceptedAnswers: [{ answer: "Hello", caseSensitive: true }],
        textAnswer: "hello",
      }),
    ])
    expect(result.gradedQuestions[0]).toMatchObject({ isCorrect: null, points: 0 })
  })

  it("acepta el primer match dentro de las aceptadas", () => {
    const result = autoGrade([
      fillQuestion({
        acceptedAnswers: [
          { answer: "color", caseSensitive: false },
          { answer: "colour", caseSensitive: false },
        ],
        textAnswer: "Colour",
      }),
    ])
    expect(result.gradedQuestions[0]).toMatchObject({ isCorrect: true, points: 1 })
  })

  it("marca incorrecta si vino vacío (no es null para revisión)", () => {
    const result = autoGrade([
      fillQuestion({
        acceptedAnswers: [{ answer: "hello", caseSensitive: false }],
        textAnswer: "  ",
      }),
    ])
    expect(result.gradedQuestions[0]).toMatchObject({ isCorrect: false, points: 0 })
  })

  it("marca null cuando respondió pero no matchea ninguna aceptada → revisión humana", () => {
    const result = autoGrade([
      fillQuestion({
        acceptedAnswers: [{ answer: "hello", caseSensitive: false }],
        textAnswer: "hi",
      }),
    ])
    expect(result.gradedQuestions[0]).toMatchObject({ isCorrect: null, points: 0 })
  })

  it("marca null cuando no hay aceptadas configuradas", () => {
    const result = autoGrade([fillQuestion({ acceptedAnswers: [], textAnswer: "any" })])
    expect(result.gradedQuestions[0]).toMatchObject({ isCorrect: null, points: 0 })
  })
})

describe("autoGrade — agregación por sección", () => {
  it("agrupa por sectionOrder y devuelve % correcto", () => {
    const options = [
      { id: "a", text: "ok", isCorrect: true, order: 0 },
      { id: "b", text: "x", isCorrect: false, order: 1 },
    ]
    const result = autoGrade([
      mcQuestion({
        id: "1",
        order: 1,
        sectionOrder: 1,
        cefrLevelCode: "A1",
        options,
        selectedOptionId: "a",
      }),
      mcQuestion({
        id: "2",
        order: 2,
        sectionOrder: 1,
        cefrLevelCode: "A1",
        options,
        selectedOptionId: "a",
      }),
      mcQuestion({
        id: "3",
        order: 3,
        sectionOrder: 1,
        cefrLevelCode: "A1",
        options,
        selectedOptionId: "b",
      }),
      mcQuestion({
        id: "4",
        order: 4,
        sectionOrder: 2,
        cefrLevelCode: "A2",
        options,
        selectedOptionId: "b",
      }),
      mcQuestion({
        id: "5",
        order: 5,
        sectionOrder: 2,
        cefrLevelCode: "A2",
        options,
        selectedOptionId: "a",
      }),
    ])
    expect(result.sectionResults).toEqual([
      {
        sectionOrder: 1,
        cefrLevelCode: "A1",
        totalQuestions: 3,
        correctAnswers: 2,
        scorePercent: 67,
        passedThreshold: false,
      },
      {
        sectionOrder: 2,
        cefrLevelCode: "A2",
        totalQuestions: 2,
        correctAnswers: 1,
        scorePercent: 50,
        passedThreshold: false,
      },
    ])
    expect(result.autoScore).toBe(3)
    expect(result.maxAutoScore).toBe(5)
  })

  it("omite del agregado las preguntas sin sectionOrder/cefrLevelCode (CERTIFICATION)", () => {
    const options = [
      { id: "a", text: "ok", isCorrect: true, order: 0 },
      { id: "b", text: "x", isCorrect: false, order: 1 },
    ]
    const result = autoGrade([
      mcQuestion({
        id: "x",
        sectionOrder: null,
        cefrLevelCode: null,
        options,
        selectedOptionId: "a",
      }),
    ])
    expect(result.sectionResults).toEqual([])
    expect(result.autoScore).toBe(1)
  })

  it("ordena sectionResults por sectionOrder ascendente", () => {
    const options = [{ id: "a", text: "x", isCorrect: true, order: 0 }]
    const result = autoGrade([
      mcQuestion({ id: "1", sectionOrder: 3, cefrLevelCode: "B1", options, selectedOptionId: "a" }),
      mcQuestion({ id: "2", sectionOrder: 1, cefrLevelCode: "A1", options, selectedOptionId: "a" }),
      mcQuestion({ id: "3", sectionOrder: 2, cefrLevelCode: "A2", options, selectedOptionId: "a" }),
    ])
    expect(result.sectionResults.map((s) => s.sectionOrder)).toEqual([1, 2, 3])
  })
})
