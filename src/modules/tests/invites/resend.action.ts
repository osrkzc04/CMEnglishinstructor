"use server"

import { revalidatePath } from "next/cache"
import { requireRole, ForbiddenError } from "@/modules/auth/guards"
import { getInviteForResend } from "./queries"
import { sendTestInvitationEmail } from "./emails"

/**
 * Re-encola el email de invitación de un `InviteToken` existente.
 *
 * No regenera el token ni cambia la caducidad — la idea es que el candidato
 * reciba un correo nuevo con el mismo link. Si el token ya venció o ya hay
 * una sesión iniciada, no tiene sentido reenviar y devolvemos error.
 *
 * Solo DIRECTOR / COORDINATOR.
 */
export type ResendTestInviteResult =
  | { success: true; emailQueued: boolean }
  | { success: false; error: string }

export async function resendTestInvite(inviteId: string): Promise<ResendTestInviteResult> {
  try {
    await requireRole(["DIRECTOR", "COORDINATOR"])
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { success: false, error: "Sin permisos para reenviar invitaciones" }
    }
    throw err
  }

  const invite = await getInviteForResend(inviteId)
  if (!invite) {
    return { success: false, error: "La invitación no existe" }
  }
  if (invite.expiresAt < new Date()) {
    return {
      success: false,
      error: "El enlace ya venció. Crea una invitación nueva para este candidato.",
    }
  }
  if (invite.session) {
    return {
      success: false,
      error: "El candidato ya inició la evaluación, no tiene sentido reenviar el enlace.",
    }
  }

  const sent = await sendTestInvitationEmail({
    inviteId: invite.id,
    to: invite.candidateEmail,
    candidateName: invite.candidateName,
    token: invite.token,
    expiresAt: invite.expiresAt,
    timeLimitMinutes: invite.template.timeLimitMinutes,
  })

  revalidatePath("/admin/pruebas")

  return { success: true, emailQueued: sent.ok }
}
