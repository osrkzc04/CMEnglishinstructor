"use server"

import { hash } from "bcryptjs"
import { z } from "zod"
import { UserStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { consumeUserToken } from "./tokens"

/**
 * Setea la contraseña del usuario consumiendo un token (activación o reset).
 * Token y password se validan en el server; el token es de un solo uso —
 * tras esta llamada, el enlace queda inválido.
 *
 * Activación: además de setear `passwordHash`, marca al usuario `ACTIVE`.
 * Reset: solo cambia `passwordHash`.
 */

const SetPasswordSchema = z
  .object({
    token: z.string().min(1, "Enlace inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres").max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })

export type SetPasswordInput = z.infer<typeof SetPasswordSchema>

type Result =
  | {
      success: true
      purpose: "activation" | "reset"
    }
  | {
      success: false
      error: string
      field?: keyof SetPasswordInput
    }

export async function setPasswordWithToken(
  input: SetPasswordInput,
): Promise<Result> {
  const parsed = SetPasswordSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof SetPasswordInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }

  const consumed = await consumeUserToken(parsed.data.token)
  if (!consumed) {
    return {
      success: false,
      error: "El enlace es inválido o ya expiró. Solicitá uno nuevo.",
    }
  }

  const passwordHash = await hash(parsed.data.password, 10)

  await prisma.user.update({
    where: { id: consumed.userId },
    data: {
      passwordHash,
      ...(consumed.purpose === "activation"
        ? { status: UserStatus.ACTIVE }
        : {}),
    },
  })

  return { success: true, purpose: consumed.purpose }
}
