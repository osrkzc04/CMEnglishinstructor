"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { issueAndSendActivation, issueAndSendPasswordReset } from "./emails"

/**
 * Reenvía el enlace de acceso al usuario:
 *  - Si nunca seteó contraseña → email de activación
 *  - Si ya tiene contraseña    → email de recuperación
 *
 * Solo se permite sobre usuarios `ACTIVE`. Si el usuario está desactivado,
 * primero hay que reactivarlo desde el detalle — sin esto, el link
 * activaría / le permitiría volver a entrar a alguien que admin sacó.
 */

const InputSchema = z.object({
  userId: z.string().cuid(),
})

type Result = { success: true; kind: "activation" | "reset" } | { success: false; error: string }

export async function resendAccessLink(input: { userId: string }): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = InputSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Datos inválidos" }

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      status: true,
      passwordHash: true,
    },
  })
  if (!user) return { success: false, error: "Usuario no encontrado" }
  if (user.status !== "ACTIVE") {
    return {
      success: false,
      error: "Activá al usuario antes de reenviarle el enlace.",
    }
  }

  const args = {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
  }
  const result = user.passwordHash
    ? await issueAndSendPasswordReset(args)
    : await issueAndSendActivation(args)

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return {
        success: false,
        error: "Demasiados intentos recientes. Probá en unos minutos.",
      }
    }
    return {
      success: false,
      error: "No pudimos enviar el correo. Revisá la configuración de email.",
    }
  }

  return {
    success: true,
    kind: user.passwordHash ? "reset" : "activation",
  }
}
