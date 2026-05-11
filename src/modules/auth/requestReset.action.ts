"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { issueAndSendPasswordReset } from "./emails"

/**
 * Solicita un email de recuperación de contraseña. La respuesta es siempre
 * `{ success: true }` para no revelar si el email está registrado — defensa
 * contra enumeración de cuentas. Si el usuario no existe, no está activo, o
 * superó el rate limit, igual devolvemos éxito; el email simplemente no se
 * envía.
 */

const InputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
})

export type RequestResetInput = z.infer<typeof InputSchema>

type Result = { success: true } | { success: false; error: string; field?: keyof RequestResetInput }

export async function requestPasswordReset(input: RequestResetInput): Promise<Result> {
  const parsed = InputSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof RequestResetInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, firstName: true, status: true },
  })

  if (user && user.status === "ACTIVE") {
    // Best-effort: si el envío falla o el usuario excedió el rate limit, lo
    // tragamos silenciosamente para mantener la respuesta uniforme.
    await issueAndSendPasswordReset({
      userId: user.id,
      email: parsed.data.email,
      firstName: user.firstName,
      rateLimit: true,
    })
  }

  return { success: true }
}
