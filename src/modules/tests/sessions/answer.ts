import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import {
  DeviceMismatchError,
  InvalidStateError,
  SectionLockedError,
  SessionNotFoundError,
  TimedOutError,
} from "./errors"
import { checkDeviceAccess } from "./device-lock"
import { finalizeAsTimedOut } from "./finalize-as-timed-out"

/**
 * Guarda la respuesta de una pregunta. Auto-save desde el cliente — la UI
 * llama esta acción al cambiar de pregunta o tras debounce de 500 ms.
 *
 * Idempotente: el mismo input sobreescribe los mismos valores.
 *
 * Reglas:
 *  - Device lock obligatorio.
 *  - Si la sesión venció (deadline + GRACE_MS), finalizar como TIMED_OUT y
 *    lanzar TimedOutError para que el cliente redirija a /finalizado.
 *  - Solo se puede responder a preguntas de `currentSectionOrder`. Intentar
 *    editar una sección ya commiteada → SectionLockedError (403).
 */

export const AnswerInputSchema = z.object({
  sessionId: z.string().min(1),
  questionOrder: z.coerce.number().int().min(1),
  selectedOptionId: z.string().min(1).nullable().optional(),
  textAnswer: z.string().max(2000).nullable().optional(),
  markedForReview: z.boolean().optional(),
})

export type AnswerInput = z.infer<typeof AnswerInputSchema>

export type AnswerContext = {
  userAgent: string | null
  ip: string | null
  cookieValue: string | null
}

export type AnswerResult = {
  savedAt: Date
  remainingMs: number
}

const GRACE_MS = 30_000 // 30 s de tolerancia para latencia de red

export async function saveAnswer(input: AnswerInput, ctx: AnswerContext): Promise<AnswerResult> {
  const session = await prisma.testSession.findUnique({
    where: { id: input.sessionId },
    select: {
      id: true,
      status: true,
      deadline: true,
      currentSectionOrder: true,
      deviceCookieHash: true,
      deviceFingerprint: true,
    },
  })
  if (!session) throw new SessionNotFoundError()

  const access = checkDeviceAccess({
    cookieHashOnSession: session.deviceCookieHash,
    fingerprintOnSession: session.deviceFingerprint,
    cookieValueFromRequest: ctx.cookieValue,
    userAgentFromRequest: ctx.userAgent,
    ipFromRequest: ctx.ip,
  })
  if (!access.ok) throw new DeviceMismatchError(access.reason)

  if (session.status !== "IN_PROGRESS") {
    throw new InvalidStateError("La sesión ya no admite cambios")
  }

  const now = new Date()
  if (now.getTime() > session.deadline.getTime() + GRACE_MS) {
    await prisma.$transaction(async (tx) => {
      await finalizeAsTimedOut(tx, session.id)
    })
    throw new TimedOutError()
  }

  // Verificar que la pregunta pertenece a la sección actual.
  const question = await prisma.testSessionQuestion.findUnique({
    where: { sessionId_order: { sessionId: session.id, order: input.questionOrder } },
    select: { id: true, sectionOrder: true },
  })
  if (!question) throw new InvalidStateError("Pregunta inexistente")
  if (question.sectionOrder !== null && question.sectionOrder !== session.currentSectionOrder) {
    throw new SectionLockedError()
  }

  await prisma.testSessionQuestion.update({
    where: { id: question.id },
    data: {
      selectedOptionId: input.selectedOptionId ?? null,
      textAnswer: input.textAnswer ?? null,
      answeredAt: now,
      ...(typeof input.markedForReview === "boolean"
        ? { markedForReview: input.markedForReview }
        : {}),
    },
  })

  return {
    savedAt: now,
    remainingMs: Math.max(0, session.deadline.getTime() - now.getTime()),
  }
}
