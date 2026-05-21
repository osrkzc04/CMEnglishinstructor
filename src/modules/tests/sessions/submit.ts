import "server-only"
import { prisma } from "@/lib/prisma"
import { autoGrade } from "../grading/auto-grade"
import {
  DeviceMismatchError,
  InvalidStateError,
  SessionNotFoundError,
  TimedOutError,
} from "./errors"
import { checkDeviceAccess } from "./device-lock"
import { finalizeAsTimedOut } from "./finalize-as-timed-out"

/**
 * Submit explícito. En la práctica el flujo adaptativo cierra la sesión a
 * través de `advanceSection` cuando el candidato pasa la última sección o no
 * alcanza el umbral. Este endpoint queda como red de seguridad:
 *  - Cron / cliente que detecta deadline vencido.
 *  - Edge case donde el candidato quiere "rendirse" antes (futuro botón
 *    "Abandonar"). Por ahora no se expone en UI.
 *
 * Reglas:
 *  - Device lock obligatorio.
 *  - Idempotente: si ya está SUBMITTED / TIMED_OUT / REVIEWED, devuelve el
 *    estado actual sin recalcular.
 */

const GRACE_MS = 30_000

// Igual que en advance-section: el autoGrade global hace hasta ~120 updates
// en bucle. Contra Neon US East el default de 5 s se queda corto y la
// transacción muere con "Transaction not found". Margen amplio acá.
const TX_MAX_WAIT_MS = 10_000
const TX_TIMEOUT_MS = 60_000

export type SubmitContext = {
  userAgent: string | null
  ip: string | null
  cookieValue: string | null
}

export type SubmitResult = {
  status: "SUBMITTED" | "TIMED_OUT"
  autoScore: number
  maxAutoScore: number
}

export async function submitPlacementSession(
  sessionId: string,
  ctx: SubmitContext,
): Promise<SubmitResult> {
  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      deadline: true,
      deviceCookieHash: true,
      deviceFingerprint: true,
      autoScore: true,
      maxAutoScore: true,
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

  if (session.status === "SUBMITTED" || session.status === "TIMED_OUT") {
    return {
      status: session.status,
      autoScore: session.autoScore ?? 0,
      maxAutoScore: session.maxAutoScore ?? 0,
    }
  }
  if (session.status !== "IN_PROGRESS") {
    throw new InvalidStateError("La sesión ya no admite cambios")
  }

  const now = new Date()
  if (now.getTime() > session.deadline.getTime() + GRACE_MS) {
    const result = await prisma.$transaction(
      async (tx) => {
        return await finalizeAsTimedOut(tx, session.id)
      },
      { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS },
    )
    if (!result) throw new TimedOutError()
    return {
      status: "TIMED_OUT",
      autoScore: result.autoScore,
      maxAutoScore: result.maxAutoScore,
    }
  }

  return await prisma.$transaction(
    async (tx) => {
      const all = await tx.testSessionQuestion.findMany({ where: { sessionId: session.id } })
      const full = autoGrade(all)
      for (const g of full.gradedQuestions) {
        await tx.testSessionQuestion.update({
          where: { id: g.questionRowId },
          data: { isCorrect: g.isCorrect, pointsAwarded: g.points },
        })
      }
      await tx.testSession.update({
        where: { id: session.id },
        data: {
          autoScore: full.autoScore,
          maxAutoScore: full.maxAutoScore,
          submittedAt: new Date(),
          status: "SUBMITTED",
        },
      })
      return {
        status: "SUBMITTED" as const,
        autoScore: full.autoScore,
        maxAutoScore: full.maxAutoScore,
      }
    },
    { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS },
  )
}
