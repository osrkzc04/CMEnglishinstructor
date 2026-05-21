import "server-only"
import type { Prisma } from "@prisma/client"
import { autoGrade } from "../grading/auto-grade"

/**
 * Marca una sesión como TIMED_OUT y la auto-califica.
 *
 * Lazy: cualquier endpoint que detecte deadline vencido debe invocar esto
 * ANTES de responder. Cron: recorre sesiones donde el candidato cerró el
 * navegador y nunca volvió.
 *
 * Idempotente: si la sesión ya está en estado terminal, no-op.
 *
 * IMPORTANTE: si recibe `tx`, NO debe encolar emails — esos se manejan
 * fuera de transacción por el caller (regla del proyecto).
 */
export async function finalizeAsTimedOut(
  tx: Prisma.TransactionClient,
  sessionId: string,
): Promise<{ wasIdempotent: boolean; autoScore: number; maxAutoScore: number } | null> {
  const session = await tx.testSession.findUnique({
    where: { id: sessionId },
    include: { questions: true },
  })
  if (!session) return null
  if (session.status !== "IN_PROGRESS") {
    return {
      wasIdempotent: true,
      autoScore: session.autoScore ?? 0,
      maxAutoScore: session.maxAutoScore ?? 0,
    }
  }

  const { autoScore, maxAutoScore, gradedQuestions } = autoGrade(session.questions)

  // Persistir grading por pregunta.
  for (const g of gradedQuestions) {
    await tx.testSessionQuestion.update({
      where: { id: g.questionRowId },
      data: { isCorrect: g.isCorrect, pointsAwarded: g.points },
    })
  }

  await tx.testSession.update({
    where: { id: sessionId },
    data: {
      autoScore,
      maxAutoScore,
      submittedAt: new Date(),
      status: "TIMED_OUT",
    },
  })

  return { wasIdempotent: false, autoScore, maxAutoScore }
}
