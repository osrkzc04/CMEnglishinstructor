import "server-only"
import { prisma } from "@/lib/prisma"
import { autoGrade } from "../grading/auto-grade"
import {
  DeviceMismatchError,
  InvalidStateError,
  SectionIncompleteError,
  SessionNotFoundError,
  TimedOutError,
} from "./errors"
import { checkDeviceAccess } from "./device-lock"
import { finalizeAsTimedOut } from "./finalize-as-timed-out"
import { logSessionEvent } from "./log-event"

/**
 * Cierra la sección actual y decide si abrir la siguiente o terminar.
 *
 * Se invoca cuando el candidato hace clic en "Continuar". El cliente valida
 * "20/20 respondidas" como feedback inmediato; el servidor lo re-verifica.
 *
 * Devuelve:
 *  - { advanced: true, nextSectionOrder } si pasó el umbral y hay siguiente.
 *  - { advanced: false, status: 'SUBMITTED'|'TIMED_OUT' } si terminó (corte
 *    adaptativo silencioso o última sección completa).
 *
 * Reglas:
 *  - Device lock obligatorio.
 *  - Deadline lazy expire.
 *  - Todas las preguntas de la sección actual deben tener respuesta
 *    (selectedOptionId no null para MC, textAnswer no vacío para fill).
 *  - El grading de la sección se persiste en `TestSessionQuestion`
 *    (isCorrect/pointsAwarded) — no se recalcula al final.
 */

const GRACE_MS = 30_000

// Las transacciones graban en bucle (1 update por pregunta de la sección, o
// hasta ~120 al cerrar todo el examen). Contra Neon US East el RTT empuja el
// total por encima del default de 5s; los timeouts explícitos evitan que la
// transacción muera con "Transaction not found".
const TX_MAX_WAIT_MS = 10_000
const TX_TIMEOUT_MS = 60_000

export type AdvanceContext = {
  userAgent: string | null
  ip: string | null
  cookieValue: string | null
}

export type AdvanceResult =
  | { advanced: true; nextSectionOrder: number }
  | {
      advanced: false
      status: "SUBMITTED" | "TIMED_OUT"
      reason: "FAILED_THRESHOLD" | "ALL_SECTIONS_COMPLETED"
    }

export async function advanceSection(
  sessionId: string,
  ctx: AdvanceContext,
): Promise<AdvanceResult> {
  // Cargar fuera de transacción para validaciones rápidas.
  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      deadline: true,
      currentSectionOrder: true,
      deviceCookieHash: true,
      deviceFingerprint: true,
      templateId: true,
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
    await prisma.$transaction(
      async (tx) => {
        await finalizeAsTimedOut(tx, session.id)
      },
      { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS },
    )
    throw new TimedOutError()
  }

  // Cargar la sección actual + la siguiente desde el template.
  const sections = await prisma.testTemplateSection.findMany({
    where: { templateId: session.templateId },
    orderBy: { order: "asc" },
    include: { level: { select: { code: true } } },
  })
  const currentSection = sections.find((s) => s.order === session.currentSectionOrder)
  if (!currentSection) {
    throw new InvalidStateError("Sección actual no existe en la plantilla")
  }

  // Validar que todas las preguntas de la sección actual están respondidas.
  const currentQuestions = await prisma.testSessionQuestion.findMany({
    where: { sessionId: session.id, sectionOrder: session.currentSectionOrder },
    select: {
      id: true,
      typeSnapshot: true,
      selectedOptionId: true,
      textAnswer: true,
    },
  })
  if (currentQuestions.length === 0) {
    throw new InvalidStateError("La sección actual no tiene preguntas snapshotadas")
  }
  const allAnswered = currentQuestions.every((q) =>
    q.typeSnapshot === "MULTIPLE_CHOICE"
      ? q.selectedOptionId !== null
      : q.textAnswer !== null && q.textAnswer.trim().length > 0,
  )
  if (!allAnswered) throw new SectionIncompleteError()

  // Calificar la sección actual (subset). Reutilizamos autoGrade pasando solo
  // las preguntas de la sección — devuelve sectionResults con scorePercent.
  const sectionQuestions = await prisma.testSessionQuestion.findMany({
    where: { sessionId: session.id, sectionOrder: session.currentSectionOrder },
  })
  const grade = autoGrade(sectionQuestions)
  const sectionResult = grade.sectionResults.find(
    (r) => r.sectionOrder === session.currentSectionOrder,
  )
  if (!sectionResult) {
    throw new InvalidStateError("No se pudo calcular el resultado de la sección")
  }

  // Persistir grading por pregunta de la sección.
  await prisma.$transaction(
    async (tx) => {
      for (const g of grade.gradedQuestions) {
        await tx.testSessionQuestion.update({
          where: { id: g.questionRowId },
          data: { isCorrect: g.isCorrect, pointsAwarded: g.points },
        })
      }
    },
    { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS },
  )

  const passed = sectionResult.scorePercent >= currentSection.passingPercent
  const nextSection = sections.find((s) => s.order === session.currentSectionOrder + 1)

  if (passed && nextSection) {
    await prisma.$transaction(
      async (tx) => {
        await tx.testSession.update({
          where: { id: session.id },
          data: { currentSectionOrder: nextSection.order },
        })
        await logSessionEvent({
          sessionId: session.id,
          type: "SECTION_ADVANCED",
          metadata: {
            fromOrder: session.currentSectionOrder,
            toOrder: nextSection.order,
            scorePercent: sectionResult.scorePercent,
          },
        })
      },
      { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS },
    )
    return { advanced: true, nextSectionOrder: nextSection.order }
  }

  // Cierre: no pasó umbral, o no hay sección siguiente.
  // En ambos casos, finalizamos como SUBMITTED y autogradeamos el total.
  const reason: "FAILED_THRESHOLD" | "ALL_SECTIONS_COMPLETED" = passed
    ? "ALL_SECTIONS_COMPLETED"
    : "FAILED_THRESHOLD"

  await prisma.$transaction(
    async (tx) => {
      // Recargar todas las preguntas para autoGrade global (las de secciones
      // bloqueadas ya están graded, las futuras sin responder quedan como
      // incorrect/false). En la práctica, secciones no desbloqueadas tienen
      // sectionOrder definido pero sin respuesta — autoGrade las marca como
      // incorrectas. Para el `autoScore` total eso da el mismo número que si
      // ignoraramos las secciones no respondidas, porque restan 0 puntos.
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
      await logSessionEvent({
        sessionId: session.id,
        type: "SECTION_LOCKED",
        metadata: {
          sectionOrder: session.currentSectionOrder,
          scorePercent: sectionResult.scorePercent,
          reason,
        },
      })
    },
    { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS },
  )

  // Notificación a coordinación queda para `submit.ts` cuando se invoque por
  // botón "Finalizar" — acá no encolamos email porque la regla del proyecto
  // dice "no encolar dentro de transacción", y la lógica de "examen listo
  // para revisar" pertenece al submit. Las sesiones que llegan a este path
  // (corte adaptativo) las recoge el mismo flujo de revisión admin: aparecen
  // como SUBMITTED en `/admin/pruebas`.

  return { advanced: false, status: "SUBMITTED", reason }
}
