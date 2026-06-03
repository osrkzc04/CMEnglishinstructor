"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { TestEventType, TestSessionStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireRole } from "@/modules/auth/guards"
import { sendTestReopenedEmail } from "../invites/emails"

/**
 * Reabre una sesión de prueba cerrada para que el candidato pueda continuar.
 *
 * Caso de uso: el candidato perdió internet, cerró el navegador, se quedó sin
 * batería, etc. Coordinación hace clic en "Reabrir" desde
 * `/admin/pruebas/[id]` y el candidato puede volver a entrar desde el mismo
 * enlace del correo original (o el correo nuevo que se le envía).
 *
 * Estados reabribles: TIMED_OUT, PENDING_WRITING, SUBMITTED, REVIEWED.
 *
 * Qué hace, exactamente:
 *  - Recalcula el estado al que vuelve la sesión:
 *      - Si ya pasó por el writing (writingPromptSnapshot existe) → vuelve
 *        a PENDING_WRITING. La respuesta del writing se preserva como
 *        borrador editable.
 *      - Si no llegó al writing → vuelve a IN_PROGRESS en la sección
 *        donde quedó.
 *  - Empuja el deadline a `now + extendMinutes` (default: el tiempo total
 *    de la plantilla).
 *  - Limpia `submittedAt`, `reviewedAt`, `reviewerNotes`, `resultsToken` y
 *    `resultsTokenExpiresAt`. Si la sesión estaba REVIEWED, la evaluación
 *    de habilidades (`PlacementSkillEvaluation`) se preserva como
 *    referencia histórica; el siguiente cierre la sobrescribe.
 *  - Libera el bloqueo de dispositivo (`deviceCookieHash` /
 *    `deviceFingerprint`) para que el candidato pueda entrar desde otra
 *    computadora si la primera quedó inaccesible.
 *  - Registra un evento SESSION_RESUMED con `metadata.source = "admin_reopen"`
 *    para auditoría.
 *  - Encola un correo "Reabrimos tu evaluación" con el mismo enlace y la
 *    nueva fecha límite.
 */

const ReopenInputSchema = z.object({
  sessionId: z.string().min(1),
  extendMinutes: z.coerce.number().int().min(5).max(240).optional(),
})

export type ReopenInput = z.infer<typeof ReopenInputSchema>

export type ReopenResult =
  | {
      success: true
      newStatus: "IN_PROGRESS" | "PENDING_WRITING"
      newDeadline: string
      emailQueued: boolean
    }
  | { success: false; error: string }

const REOPENABLE_STATUSES: TestSessionStatus[] = [
  "TIMED_OUT",
  "PENDING_WRITING",
  "SUBMITTED",
  "REVIEWED",
]

export async function reopenTestSession(input: ReopenInput): Promise<ReopenResult> {
  let currentUserId: string
  try {
    const user = await requireRole(["DIRECTOR", "COORDINATOR"])
    currentUserId = user.id
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { success: false, error: "Sin permisos para reabrir esta evaluación" }
    }
    throw err
  }

  const parsed = ReopenInputSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { success: false, error: first?.message ?? "Datos inválidos" }
  }
  const data = parsed.data

  const session = await prisma.testSession.findUnique({
    where: { id: data.sessionId },
    select: {
      id: true,
      status: true,
      writingPromptSnapshot: true,
      candidateEmail: true,
      candidateName: true,
      template: { select: { timeLimitMinutes: true } },
      invite: { select: { token: true } },
    },
  })
  if (!session) {
    return { success: false, error: "Evaluación no encontrada" }
  }
  if (!REOPENABLE_STATUSES.includes(session.status)) {
    return {
      success: false,
      error: "La evaluación está en curso o en un estado que no se puede reabrir",
    }
  }

  const targetStatus: "IN_PROGRESS" | "PENDING_WRITING" =
    session.writingPromptSnapshot !== null ? "PENDING_WRITING" : "IN_PROGRESS"
  const extendMinutes = data.extendMinutes ?? session.template.timeLimitMinutes
  const newDeadline = new Date(Date.now() + extendMinutes * 60_000)
  const previousStatus = session.status

  await prisma.$transaction(async (tx) => {
    await tx.testSession.update({
      where: { id: session.id },
      data: {
        status: targetStatus,
        deadline: newDeadline,
        submittedAt: null,
        reviewedAt: null,
        reviewedBy: null,
        reviewerNotes: null,
        deviceCookieHash: null,
        deviceFingerprint: null,
        resultsToken: null,
        resultsTokenExpiresAt: null,
      },
    })

    await tx.testSessionEvent.create({
      data: {
        sessionId: session.id,
        type: TestEventType.SESSION_RESUMED,
        metadata: {
          source: "admin_reopen",
          reopenedBy: currentUserId,
          previousStatus,
          newDeadline: newDeadline.toISOString(),
          extendMinutes,
        },
      },
    })
  })

  // Correo fuera de transacción (regla del proyecto).
  let emailQueued = false
  if (session.invite.token) {
    const result = await sendTestReopenedEmail({
      sessionId: session.id,
      to: session.candidateEmail,
      candidateName: session.candidateName,
      token: session.invite.token,
      deadline: newDeadline,
    })
    emailQueued = result.ok
  }

  revalidatePath("/admin/pruebas")
  revalidatePath(`/admin/pruebas/${session.id}`)

  return {
    success: true,
    newStatus: targetStatus,
    newDeadline: newDeadline.toISOString(),
    emailQueued,
  }
}
