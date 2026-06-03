"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { requireRole, ForbiddenError } from "@/modules/auth/guards"
import { autoGrade } from "./auto-grade"
import { sendTestResultsEmail } from "../invites/emails"
import { ManualReviewInputSchema, type ManualReviewInput, type ManualReviewResult } from "./schemas"

/**
 * Cierra la revisión humana de un placement test.
 *
 * Solo DIRECTOR / COORDINATOR. Se llama desde `/admin/pruebas/[id]`.
 *
 * Pasos:
 *  1. requireRole(["DIRECTOR", "COORDINATOR"]).
 *  2. Validar TestSession existe y status in ['SUBMITTED', 'TIMED_OUT', 'REVIEWED'].
 *     - Si ya está REVIEWED, permitimos re-grabar la evaluación R/W/L/S pero
 *       NO regeneramos el token (el candidato ya recibió el link).
 *  3. Re-correr autoGrade contra el snapshot para asegurar que `autoScore` /
 *     `maxAutoScore` y los `isCorrect` por pregunta están al día — defensivo
 *     contra estados antiguos generados antes de un cambio en el grader.
 *  4. Upsert PlacementSkillEvaluation con R/W/L/S, assignedLevelId, reviewerNotes,
 *     reviewedBy, reviewedAt.
 *  5. Update TestSession: status='REVIEWED', reviewedBy, reviewedAt,
 *     reviewerNotes, autoScore, maxAutoScore. Genera `resultsToken` (32 bytes hex)
 *     + `resultsTokenExpiresAt = now + 12h` solo si era la primera revisión.
 *  6. Encolar EmailNotification TEST_RESULT_STUDENT con link `/resultados/[token]`
 *     fuera de la transacción.
 *
 * El email no viaja dentro de la transacción Prisma (regla del proyecto).
 */

const RESULTS_VALID_HOURS = 12

// Neon US East: el RTT × N updates de re-grading sobre snapshots (~120
// preguntas) excede el timeout default (5 s) de Prisma. Damos margen.
const TX_MAX_WAIT_MS = 10_000
const TX_TIMEOUT_MS = 60_000

export async function finalizeManualReview(input: ManualReviewInput): Promise<ManualReviewResult> {
  let currentUserId: string
  try {
    const user = await requireRole(["DIRECTOR", "COORDINATOR"])
    currentUserId = user.id
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { success: false, error: "Sin permisos para revisar esta evaluación" }
    }
    throw err
  }

  const parsed = ManualReviewInputSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    return { success: false, error: first?.message ?? "Datos inválidos" }
  }
  const data = parsed.data

  const session = await prisma.testSession.findUnique({
    where: { id: data.sessionId },
    select: {
      id: true,
      status: true,
      candidateName: true,
      candidateEmail: true,
      resultsToken: true,
      resultsTokenExpiresAt: true,
    },
  })
  if (!session) {
    return { success: false, error: "Evaluación no encontrada" }
  }
  if (
    session.status !== "SUBMITTED" &&
    session.status !== "TIMED_OUT" &&
    session.status !== "REVIEWED"
  ) {
    return {
      success: false,
      error: "La evaluación todavía no se puede revisar (sigue en curso)",
    }
  }

  // Validar el nivel asignado existe (defensivo contra valores stale del form).
  if (data.assignedLevelId) {
    const level = await prisma.cefrLevel.count({ where: { id: data.assignedLevelId } })
    if (level === 0) {
      return { success: false, error: "El nivel asignado no existe" }
    }
  }

  const isFirstReview = session.status !== "REVIEWED"
  const newResultsToken = isFirstReview ? randomBytes(32).toString("hex") : session.resultsToken
  const newResultsExpiresAt = isFirstReview
    ? new Date(Date.now() + RESULTS_VALID_HOURS * 60 * 60 * 1000)
    : session.resultsTokenExpiresAt

  try {
    await prisma.$transaction(
      async (tx) => {
        // Re-correr autoGrade — asegura idempotencia y que los campos derivados
        // queden consistentes incluso si la sesión llegó a REVIEWED por flujos
        // antiguos.
        const all = await tx.testSessionQuestion.findMany({ where: { sessionId: session.id } })
        const graded = autoGrade(all)
        for (const g of graded.gradedQuestions) {
          await tx.testSessionQuestion.update({
            where: { id: g.questionRowId },
            data: { isCorrect: g.isCorrect, pointsAwarded: g.points },
          })
        }

        const now = new Date()

        await tx.placementSkillEvaluation.upsert({
          where: { sessionId: session.id },
          create: {
            sessionId: session.id,
            reading: toDecimal(data.reading),
            writing: toDecimal(data.writing),
            listening: toDecimal(data.listening),
            speaking: toDecimal(data.speaking),
            assignedLevelId: data.assignedLevelId,
            reviewerNotes: data.reviewerNotes,
            writingFeedback: data.writingFeedback,
            reviewedBy: currentUserId,
            reviewedAt: now,
          },
          update: {
            reading: toDecimal(data.reading),
            writing: toDecimal(data.writing),
            listening: toDecimal(data.listening),
            speaking: toDecimal(data.speaking),
            assignedLevelId: data.assignedLevelId,
            reviewerNotes: data.reviewerNotes,
            writingFeedback: data.writingFeedback,
            reviewedBy: currentUserId,
            reviewedAt: now,
          },
        })

        await tx.testSession.update({
          where: { id: session.id },
          data: {
            status: "REVIEWED",
            reviewedBy: currentUserId,
            reviewedAt: now,
            reviewerNotes: data.reviewerNotes,
            autoScore: graded.autoScore,
            maxAutoScore: graded.maxAutoScore,
            resultsToken: newResultsToken,
            resultsTokenExpiresAt: newResultsExpiresAt,
          },
        })
      },
      { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS },
    )
  } catch (err) {
    // Token unique colisión (probabilidad ~0 con 256 bits).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { success: false, error: "Conflicto generando el token de resultado, reintenta" }
    }
    throw err
  }

  // Email fuera de transacción. Solo en la primera revisión — no spammeamos al
  // candidato si la directora vuelve a guardar para corregir una nota.
  let emailQueued = false
  if (isFirstReview && newResultsToken && newResultsExpiresAt) {
    const sendResult = await sendTestResultsEmail({
      sessionId: session.id,
      to: session.candidateEmail,
      candidateName: session.candidateName,
      resultsToken: newResultsToken,
      expiresAt: newResultsExpiresAt,
      scores: {
        reading: data.reading ?? null,
        writing: data.writing ?? null,
        listening: data.listening ?? null,
        speaking: data.speaking ?? null,
      },
      writingFeedback: data.writingFeedback,
    })
    emailQueued = sendResult.ok
  }

  revalidatePath("/admin/pruebas")
  revalidatePath(`/admin/pruebas/${session.id}`)

  return {
    success: true,
    sessionId: session.id,
    resultsLink: newResultsToken
      ? `${baseUrl()}/resultados/${newResultsToken}`
      : `${baseUrl()}/resultados`,
    emailQueued,
  }
}

function toDecimal(value: number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined) return null
  return new Prisma.Decimal(value)
}

function baseUrl(): string {
  return (process.env.AUTH_URL ?? "").replace(/\/$/, "")
}
