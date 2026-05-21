"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, ForbiddenError } from "@/modules/auth/guards"
import { NewTestInviteSchema, type NewTestInviteInput } from "./schemas"
import { buildTestInviteLink, sendTestInvitationEmail } from "./emails"

/**
 * Crea un `InviteToken` para un placement test y encola el email de invitación.
 *
 * Solo DIRECTOR / COORDINATOR pueden invocar.
 *
 * Reglas:
 *  - La plantilla debe ser `PLACEMENT` activa.
 *  - Se permite re-invitar el mismo correo (puede haber múltiples intentos
 *    por candidato); no se hace unique check global sobre `candidateEmail`.
 *  - Token: 32 bytes hex (256 bits) — más entropía que cuid.
 *  - Caducidad: `expiresInHours` desde ahora (default 24 h por schema).
 *  - El send del email NO va dentro de la transacción Prisma (regla del
 *    proyecto). Encolamos después de confirmar el insert.
 */
export type CreateTestInviteResult =
  | {
      success: true
      inviteId: string
      token: string
      link: string
      expiresAt: Date
      emailQueued: boolean
    }
  | { success: false; error: string; field?: keyof NewTestInviteInput }

export async function createTestInvite(input: NewTestInviteInput): Promise<CreateTestInviteResult> {
  let currentUserId: string
  try {
    const user = await requireRole(["DIRECTOR", "COORDINATOR"])
    currentUserId = user.id
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { success: false, error: "Sin permisos para crear invitaciones" }
    }
    throw err
  }

  const parsed = NewTestInviteSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    return {
      success: false,
      error: first?.message ?? "Datos inválidos",
      field: first?.path[0] as keyof NewTestInviteInput | undefined,
    }
  }
  const data = parsed.data

  const template = await prisma.testTemplate.findFirst({
    where: { id: data.templateId, purpose: "PLACEMENT", isActive: true },
    select: { id: true, timeLimitMinutes: true, name: true },
  })
  if (!template) {
    return {
      success: false,
      field: "templateId",
      error: "La plantilla seleccionada no existe o ya no está activa",
    }
  }

  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + data.expiresInHours * 60 * 60 * 1000)

  let inviteId: string
  try {
    const invite = await prisma.inviteToken.create({
      data: {
        token,
        templateId: template.id,
        candidateName: data.candidateName,
        candidateEmail: data.candidateEmail,
        candidatePhone: data.candidatePhone,
        candidateDocument: data.candidateDocument,
        notes: data.notes,
        expiresAt,
        createdBy: currentUserId,
      },
      select: { id: true },
    })
    inviteId = invite.id
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Token colisión (probabilidad ~0 con 256 bits, pero defensivo).
      return { success: false, error: "Conflicto generando el token, reintenta por favor" }
    }
    throw err
  }

  // Email fuera de transacción. Si falla, el invite ya existe — admin puede
  // reenviar desde la UI. El scheduler también recoge QUEUED periódicamente.
  const sendResult = await sendTestInvitationEmail({
    inviteId,
    to: data.candidateEmail,
    candidateName: data.candidateName,
    token,
    expiresAt,
    timeLimitMinutes: template.timeLimitMinutes,
  })

  revalidatePath("/admin/pruebas")

  return {
    success: true,
    inviteId,
    token,
    link: buildTestInviteLink(token),
    expiresAt,
    emailQueued: sendResult.ok,
  }
}
