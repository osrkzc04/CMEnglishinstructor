"use server"

import { revalidatePath } from "next/cache"
import { UserStatus } from "@prisma/client"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { sendDeactivationEmail } from "@/modules/auth/emails"
import { revokeUserTokens } from "@/modules/auth/tokens"
import { countActiveDirectors } from "./queries"

type Result = { success: true } | { success: false; error: string }

const InputSchema = z.object({
  id: z.string().cuid(),
  status: z.nativeEnum(UserStatus),
})

/**
 * Activa / desactiva un usuario staff. Reutiliza la misma política del flujo
 * de estudiantes (revocar tokens + email de cortesía) y agrega dos guards:
 *
 *  1. El director conectado no se puede desactivar a sí mismo.
 *  2. No se puede dejar al sistema sin un DIRECTOR ACTIVE.
 *
 * Solo DIRECTOR puede ejecutar — la coordinación no debe poder sacar a un
 * director del sistema.
 */
export async function setStaffStatus(input: { id: string; status: UserStatus }): Promise<Result> {
  await requireRole(["DIRECTOR"])

  const parsed = InputSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Datos inválidos" }

  const target = await prisma.user.findFirst({
    where: { id: parsed.data.id, role: { in: ["DIRECTOR", "COORDINATOR"] } },
  })
  if (!target) return { success: false, error: "Usuario no encontrado" }

  const session = await auth()
  if (session?.user?.id === target.id && parsed.data.status !== UserStatus.ACTIVE) {
    return { success: false, error: "No puedes desactivar tu propia cuenta" }
  }

  if (
    target.role === "DIRECTOR" &&
    target.status === UserStatus.ACTIVE &&
    parsed.data.status !== UserStatus.ACTIVE
  ) {
    const others = await countActiveDirectors(target.id)
    if (others === 0) {
      return {
        success: false,
        error: "No puedes dejar al sistema sin un director activo",
      }
    }
  }

  await prisma.user.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  })

  if (target.status === UserStatus.ACTIVE && parsed.data.status === UserStatus.INACTIVE) {
    await revokeUserTokens(target.id)
    await sendDeactivationEmail({
      userId: target.id,
      email: target.email,
      firstName: target.firstName,
    })
  }

  revalidatePath("/admin/usuarios")
  revalidatePath(`/admin/usuarios/${parsed.data.id}`)
  return { success: true }
}
