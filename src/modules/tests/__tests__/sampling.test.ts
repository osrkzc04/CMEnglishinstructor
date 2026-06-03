import { describe, it, expect, vi } from "vitest"
import type { Prisma } from "@prisma/client"

import { InsufficientQuestionsError, sampleQuestionsForPlacement } from "../sessions/sampling"
import type { Section } from "../shared/types"

/**
 * Tests del sorteo por sección. Cada sección hace dos $queryRaw:
 *   1) un reading (topic ILIKE 'reading') — LIMIT 1
 *   2) el resto no-reading — LIMIT (questionCount - readingCount)
 *
 * Mockeamos las dos respuestas en orden por sección. Si la primera devuelve
 * vacío, el nivel queda anotado en `missingReadingLevels` y se completa con
 * `questionCount` no-readings.
 */

type RawQuestion = {
  id: string
  prompt: string
  type: "MULTIPLE_CHOICE" | "FILL_IN"
  points: number
}

type SectionStub = {
  reading: RawQuestion[]
  rest: RawQuestion[]
}

function makeTx(opts: {
  byLevel: Record<string, SectionStub>
  optionsByQuestion?: Record<
    string,
    { id: string; questionId: string; text: string; isCorrect: boolean; order: number }[]
  >
  fillAnswersByQuestion?: Record<
    string,
    { questionId: string; acceptedAnswer: string; caseSensitive: boolean }[]
  >
}): Prisma.TransactionClient {
  // Estado por nivel: cada nivel emite primero el lote `reading`, después el
  // lote `rest`. La cuenta se reinicia cada vez que llega un levelId nuevo.
  const cursorByLevel = new Map<string, number>()
  return {
    $queryRaw: vi.fn(async (_template: TemplateStringsArray | unknown, ...values: unknown[]) => {
      const levelId = String(values[0])
      const stub = opts.byLevel[levelId] ?? { reading: [], rest: [] }
      const cursor = cursorByLevel.get(levelId) ?? 0
      cursorByLevel.set(levelId, cursor + 1)
      // Primera llamada del nivel: query del reading.
      // Segunda llamada del nivel: query del resto.
      return cursor === 0 ? stub.reading : stub.rest
    }),
    questionOption: {
      findMany: vi.fn(async ({ where }: { where: { questionId: { in: string[] } } }) => {
        const ids = where.questionId.in
        const all = Object.values(opts.optionsByQuestion ?? {}).flat()
        return all.filter((o) => ids.includes(o.questionId))
      }),
    },
    questionFillAnswer: {
      findMany: vi.fn(async ({ where }: { where: { questionId: { in: string[] } } }) => {
        const ids = where.questionId.in
        const all = Object.values(opts.fillAnswersByQuestion ?? {}).flat()
        return all.filter((a) => ids.includes(a.questionId))
      }),
    },
  } as unknown as Prisma.TransactionClient
}

const sectionsAB: Section[] = [
  {
    order: 1,
    levelId: "level-a1",
    cefrLevelCode: "A1",
    samplePoolSize: 50,
    questionCount: 2,
    passingPercent: 90,
  },
  {
    order: 2,
    levelId: "level-a2",
    cefrLevelCode: "A2",
    samplePoolSize: 50,
    questionCount: 2,
    passingPercent: 90,
  },
]

describe("sampleQuestionsForPlacement", () => {
  it("incluye exactamente 1 reading por sección cuando el banco lo tiene", async () => {
    const tx = makeTx({
      byLevel: {
        "level-a1": {
          reading: [{ id: "q1r", prompt: "Reading A1", type: "MULTIPLE_CHOICE", points: 1 }],
          rest: [{ id: "q2", prompt: "Other A1", type: "MULTIPLE_CHOICE", points: 1 }],
        },
        "level-a2": {
          reading: [{ id: "q3r", prompt: "Reading A2", type: "MULTIPLE_CHOICE", points: 1 }],
          rest: [{ id: "q4", prompt: "Other A2", type: "MULTIPLE_CHOICE", points: 1 }],
        },
      },
      optionsByQuestion: {
        q1r: [{ id: "q1r-o1", questionId: "q1r", text: "a", isCorrect: true, order: 0 }],
        q2: [{ id: "q2-o1", questionId: "q2", text: "a", isCorrect: true, order: 0 }],
        q3r: [{ id: "q3r-o1", questionId: "q3r", text: "a", isCorrect: true, order: 0 }],
        q4: [{ id: "q4-o1", questionId: "q4", text: "a", isCorrect: true, order: 0 }],
      },
    })

    const result = await sampleQuestionsForPlacement(tx, sectionsAB)

    expect(result.questions).toHaveLength(4)
    expect(result.missingReadingLevels).toEqual([])

    // Cada sección debe traer su reading y un no-reading. Como el orden
    // dentro de la sección está shufflado, comparamos por set.
    const a1Ids = result.questions.filter((q) => q.sectionOrder === 1).map((q) => q.questionId)
    const a2Ids = result.questions.filter((q) => q.sectionOrder === 2).map((q) => q.questionId)
    expect(new Set(a1Ids)).toEqual(new Set(["q1r", "q2"]))
    expect(new Set(a2Ids)).toEqual(new Set(["q3r", "q4"]))
  })

  it("aplica fallback (todas no-reading) si el banco no tiene readings", async () => {
    const tx = makeTx({
      byLevel: {
        "level-a1": {
          reading: [], // sin readings disponibles
          rest: [
            { id: "q1", prompt: "P1", type: "MULTIPLE_CHOICE", points: 1 },
            { id: "q2", prompt: "P2", type: "MULTIPLE_CHOICE", points: 1 },
          ],
        },
        "level-a2": {
          reading: [{ id: "q3r", prompt: "Reading A2", type: "MULTIPLE_CHOICE", points: 1 }],
          rest: [{ id: "q4", prompt: "Other A2", type: "MULTIPLE_CHOICE", points: 1 }],
        },
      },
      optionsByQuestion: {
        q1: [{ id: "q1-o1", questionId: "q1", text: "a", isCorrect: true, order: 0 }],
        q2: [{ id: "q2-o1", questionId: "q2", text: "a", isCorrect: true, order: 0 }],
        q3r: [{ id: "q3r-o1", questionId: "q3r", text: "a", isCorrect: true, order: 0 }],
        q4: [{ id: "q4-o1", questionId: "q4", text: "a", isCorrect: true, order: 0 }],
      },
    })

    const result = await sampleQuestionsForPlacement(tx, sectionsAB)

    expect(result.questions).toHaveLength(4)
    expect(result.missingReadingLevels).toEqual(["A1"])
  })

  it("lanza InsufficientQuestionsError si reading + resto no alcanzan", async () => {
    const tx = makeTx({
      byLevel: {
        "level-a1": {
          reading: [{ id: "q1r", prompt: "Reading", type: "MULTIPLE_CHOICE", points: 1 }],
          rest: [], // falta 1 no-reading para llegar a 2
        },
        "level-a2": {
          reading: [{ id: "q3r", prompt: "Reading A2", type: "MULTIPLE_CHOICE", points: 1 }],
          rest: [{ id: "q4", prompt: "Other", type: "MULTIPLE_CHOICE", points: 1 }],
        },
      },
    })

    await expect(sampleQuestionsForPlacement(tx, sectionsAB)).rejects.toBeInstanceOf(
      InsufficientQuestionsError,
    )
  })

  it("procesa las secciones en orden ascendente aunque vengan desordenadas", async () => {
    const reversed = [...sectionsAB].reverse()
    const tx = makeTx({
      byLevel: {
        "level-a1": {
          reading: [{ id: "q1r", prompt: "R A1", type: "MULTIPLE_CHOICE", points: 1 }],
          rest: [{ id: "q2", prompt: "O A1", type: "MULTIPLE_CHOICE", points: 1 }],
        },
        "level-a2": {
          reading: [{ id: "q3r", prompt: "R A2", type: "MULTIPLE_CHOICE", points: 1 }],
          rest: [{ id: "q4", prompt: "O A2", type: "MULTIPLE_CHOICE", points: 1 }],
        },
      },
      optionsByQuestion: {
        q1r: [{ id: "q1r-o1", questionId: "q1r", text: "a", isCorrect: true, order: 0 }],
        q2: [{ id: "q2-o1", questionId: "q2", text: "a", isCorrect: true, order: 0 }],
        q3r: [{ id: "q3r-o1", questionId: "q3r", text: "a", isCorrect: true, order: 0 }],
        q4: [{ id: "q4-o1", questionId: "q4", text: "a", isCorrect: true, order: 0 }],
      },
    })

    const result = await sampleQuestionsForPlacement(tx, reversed)
    expect(result.questions.map((r) => r.sectionOrder)).toEqual([1, 1, 2, 2])
  })

  it("trae acceptedAnswers para FILL_IN y options para MC", async () => {
    const tx = makeTx({
      byLevel: {
        "level-a1": {
          reading: [],
          rest: [
            { id: "qFill", prompt: "P", type: "FILL_IN", points: 1 },
            { id: "qMc", prompt: "P", type: "MULTIPLE_CHOICE", points: 1 },
          ],
        },
        "level-a2": {
          reading: [{ id: "qMc2", prompt: "P", type: "MULTIPLE_CHOICE", points: 1 }],
          rest: [{ id: "qMc3", prompt: "P", type: "MULTIPLE_CHOICE", points: 1 }],
        },
      },
      optionsByQuestion: {
        qMc: [{ id: "qMc-o1", questionId: "qMc", text: "a", isCorrect: true, order: 0 }],
        qMc2: [{ id: "qMc2-o1", questionId: "qMc2", text: "a", isCorrect: true, order: 0 }],
        qMc3: [{ id: "qMc3-o1", questionId: "qMc3", text: "a", isCorrect: true, order: 0 }],
      },
      fillAnswersByQuestion: {
        qFill: [{ questionId: "qFill", acceptedAnswer: "hello", caseSensitive: false }],
      },
    })

    const result = await sampleQuestionsForPlacement(tx, sectionsAB)
    const fill = result.questions.find((r) => r.questionId === "qFill")!
    expect(fill.options).toBeNull()
    expect(fill.acceptedAnswers).toEqual([{ answer: "hello", caseSensitive: false }])
    const mc = result.questions.find((r) => r.questionId === "qMc")!
    expect(mc.acceptedAnswers).toBeNull()
    expect(mc.options).toHaveLength(1)
  })
})
