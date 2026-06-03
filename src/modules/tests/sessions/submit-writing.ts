import "server-only"
import { prisma } from "@/lib/prisma"
import {
  DeviceMismatchError,
  InvalidStateError,
  SessionNotFoundError,
  TimedOutError,
} from "./errors"
import { checkDeviceAccess } from "./device-lock"
import { finalizeAsTimedOut } from "./finalize-as-timed-out"
import { logSessionEvent } from "./log-event"

/**
 * Cierra una sesión que está en PENDING_WRITING: guarda la respuesta del
 * candidato + marca SUBMITTED.
 *
 * Reglas:
 *  - Device lock obligatorio (sigue siendo la misma sesión / dispositivo).
 *  - Idempotente: si ya está SUBMITTED / TIMED_OUT, devuelve el estado.
 *  - Si el deadline venció, finaliza como TIMED_OUT pero **persiste el
 *    response** que el candidato alcanzó a escribir antes del corte —
 *    coordinación verá el texto parcial en revisión, con nota TIMED_OUT.
 *  - Texto vacío no se acepta: si se envía, devolvemos InvalidStateError
 *    para que la UI muestre el mensaje "escribe al menos una oración".
 *
 * Acá no encolamos emails dentro de la transacción (regla del proyecto);
 * el route handler los dispara después si el resultado es SUBMITTED.
 */

const GRACE_MS = 30_000
const TX_MAX_WAIT_MS = 10_000
const TX_TIMEOUT_MS = 30_000
const MIN_RESPONSE_CHARS = 1
const MAX_RESPONSE_CHARS = 8000

export type SubmitWritingContext = {
  userAgent: string | null
  ip: string | null
  cookieValue: string | null
}

export type SubmitWritingResult =
  | { status: "SUBMITTED"; writingLevelCode: string | null }
  | { status: "TIMED_OUT"; writingLevelCode: string | null }

export async function submitPlacementWriting(
  sessionId: string,
  response: string,
  ctx: SubmitWritingContext,
): Promise<SubmitWritingResult> {
  const trimmed = response.trim()
  if (trimmed.length < MIN_RESPONSE_CHARS) {
    throw new InvalidStateError("Tu respuesta no puede quedar vacía")
  }
  if (trimmed.length > MAX_RESPONSE_CHARS) {
    throw new InvalidStateError(
      `Tu respuesta supera el máximo de ${MAX_RESPONSE_CHARS} caracteres`,
    )
  }

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      deadline: true,
      deviceCookieHash: true,
      deviceFingerprint: true,
      writingLevelCode: true,
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

  // Idempotencia: si ya cerró por la vía que sea, devolvemos sin escribir.
  if (session.status === "SUBMITTED" || session.status === "TIMED_OUT") {
    return { status: session.status, writingLevelCode: session.writingLevelCode }
  }
  if (session.status !== "PENDING_WRITING") {
    throw new InvalidStateError("La sesión no espera writing en este momento")
  }

  const now = new Date()
  // Deadline vencido: guardamos el response y finalizamos como TIMED_OUT.
  if (now.getTime() > session.deadline.getTime() + GRACE_MS) {
    await prisma.$transaction(
      async (tx) => {
        // Guardamos primero el writing parcial — no queremos perder lo que
        // alcanzó a escribir solo por venir tarde.
        await tx.testSession.update({
          where: { id: session.id },
          data: { writingResponse: trimmed, writingSubmittedAt: now },
        })
        await finalizeAsTimedOut(tx, session.id)
      },
      { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS },
    )
    throw new TimedOutError()
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.testSession.update({
        where: { id: session.id },
        data: {
          writingResponse: trimmed,
          writingSubmittedAt: now,
          submittedAt: now,
          status: "SUBMITTED",
        },
      })
      await logSessionEvent({
        sessionId: session.id,
        type: "WRITING_SUBMITTED",
        metadata: {
          writingLevelCode: session.writingLevelCode,
          chars: trimmed.length,
        },
      })
    },
    { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS },
  )

  return { status: "SUBMITTED", writingLevelCode: session.writingLevelCode }
}
