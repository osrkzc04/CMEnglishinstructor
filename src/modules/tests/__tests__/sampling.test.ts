import { describe, it, expect, vi } from "vitest"
import type { Prisma } from "@prisma/client"

import { InsufficientQuestionsError, sampleQuestionsForPlacement } from "../sessions/sampling"
import type { Section } from "../shared/types"

/**
 * Tests del sorteo por sección. La aleatoriedad la hace Postgres con
 * `random()`; acá mockeamos la transacción de Prisma para chequear:
 *  - Pide la cantidad correcta por sección.
 *  - Si una sección no devuelve suficientes filas, lanza el error tipado.
 *  - Devuelve preguntas con su sectionOrder y cefrLevelCode anotados.
 *  - Las opciones de MC vienen desde QuestionOption.findMany y se asocian
 *    correctamente al questionId.
 */

type RawQuestion = {
  id: string
  prompt: string
  type: "MULTIPLE_CHOICE" | "FILL_IN"
  points: number
}

function makeTx(opts: {
  rowsByLevel: Record<string, RawQuestion[]>
  optionsByQuestion?: Record<
    string,
    { id: string; questionId: string; text: string; isCorrect: boolean; order: number }[]
  >
  fillAnswersByQuestion?: Record<
    string,
    { questionId: string; acceptedAnswer: string; caseSensitive: boolean }[]
  >
}): Prisma.TransactionClient {
  return {
    $queryRaw: vi.fn(async (template: TemplateStringsArray | unknown, ...values: unknown[]) => {
      // El SQL es siempre el mismo; la sección la inferimos del primer parámetro
      // (section.levelId) que viaja como `values[0]`.
      const levelId = String(values[0])
      return opts.rowsByLevel[levelId] ?? []
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
  it("devuelve preguntas anotadas con sectionOrder y cefrLevelCode", async () => {
    const tx = makeTx({
      rowsByLevel: {
        "level-a1": [
          { id: "q1", prompt: "P1", type: "MULTIPLE_CHOICE", points: 1 },
          { id: "q2", prompt: "P2", type: "MULTIPLE_CHOICE", points: 1 },
        ],
        "level-a2": [
          { id: "q3", prompt: "P3", type: "FILL_IN", points: 1 },
          { id: "q4", prompt: "P4", type: "MULTIPLE_CHOICE", points: 1 },
        ],
      },
      optionsByQuestion: {
        q1: [
          { id: "q1-o1", questionId: "q1", text: "a", isCorrect: true, order: 0 },
          { id: "q1-o2", questionId: "q1", text: "b", isCorrect: false, order: 1 },
        ],
        q2: [{ id: "q2-o1", questionId: "q2", text: "x", isCorrect: true, order: 0 }],
        q4: [{ id: "q4-o1", questionId: "q4", text: "y", isCorrect: true, order: 0 }],
      },
      fillAnswersByQuestion: {
        q3: [{ questionId: "q3", acceptedAnswer: "hello", caseSensitive: false }],
      },
    })

    const result = await sampleQuestionsForPlacement(tx, sectionsAB)

    expect(result).toHaveLength(4)
    expect(result.map((r) => `${r.sectionOrder}/${r.cefrLevelCode}/${r.questionId}`)).toEqual([
      "1/A1/q1",
      "1/A1/q2",
      "2/A2/q3",
      "2/A2/q4",
    ])

    const fillQ = result.find((r) => r.questionId === "q3")!
    expect(fillQ.type).toBe("FILL_IN")
    expect(fillQ.options).toBeNull()
    expect(fillQ.acceptedAnswers).toEqual([{ answer: "hello", caseSensitive: false }])

    const mcQ = result.find((r) => r.questionId === "q1")!
    expect(mcQ.type).toBe("MULTIPLE_CHOICE")
    expect(mcQ.options).toEqual([
      { id: "q1-o1", text: "a", isCorrect: true, order: 0 },
      { id: "q1-o2", text: "b", isCorrect: false, order: 1 },
    ])
  })

  it("lanza InsufficientQuestionsError si el banco no alcanza", async () => {
    const tx = makeTx({
      rowsByLevel: {
        "level-a1": [{ id: "q1", prompt: "P1", type: "MULTIPLE_CHOICE", points: 1 }],
        "level-a2": [],
      },
    })

    await expect(sampleQuestionsForPlacement(tx, sectionsAB)).rejects.toBeInstanceOf(
      InsufficientQuestionsError,
    )
    try {
      await sampleQuestionsForPlacement(tx, sectionsAB)
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientQuestionsError)
      const e = err as InsufficientQuestionsError
      expect(e.cefrLevelCode).toBe("A1")
      expect(e.required).toBe(2)
      expect(e.available).toBe(1)
    }
  })

  it("procesa las secciones en orden ascendente aunque vengan desordenadas", async () => {
    const reversed = [...sectionsAB].reverse()
    const tx = makeTx({
      rowsByLevel: {
        "level-a1": [
          { id: "q1", prompt: "P1", type: "MULTIPLE_CHOICE", points: 1 },
          { id: "q2", prompt: "P2", type: "MULTIPLE_CHOICE", points: 1 },
        ],
        "level-a2": [
          { id: "q3", prompt: "P3", type: "MULTIPLE_CHOICE", points: 1 },
          { id: "q4", prompt: "P4", type: "MULTIPLE_CHOICE", points: 1 },
        ],
      },
      optionsByQuestion: {
        q1: [{ id: "q1-o1", questionId: "q1", text: "a", isCorrect: true, order: 0 }],
        q2: [{ id: "q2-o1", questionId: "q2", text: "a", isCorrect: true, order: 0 }],
        q3: [{ id: "q3-o1", questionId: "q3", text: "a", isCorrect: true, order: 0 }],
        q4: [{ id: "q4-o1", questionId: "q4", text: "a", isCorrect: true, order: 0 }],
      },
    })

    const result = await sampleQuestionsForPlacement(tx, reversed)
    // El sortBy interno garantiza A1 (order 1) antes que A2 (order 2).
    expect(result.map((r) => r.sectionOrder)).toEqual([1, 1, 2, 2])
  })
})
