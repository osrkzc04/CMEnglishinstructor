"use server"

import { revalidatePath } from "next/cache"
import { UserStatus } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { sendDeactivationEmail } from "@/modules/auth/emails"
import { revokeUserTokens } from "@/modules/auth/tokens"

type Result = { success: true } | { success: false; error: string }

const InputSchema = z.object({
  id: z.string().cuid(),
  status: z.nativeEnum(UserStatus),
})

/**
 * Cambia el estado de un estudiante (ACTIVE / INACTIVE / PENDING_APPROVAL).
 * Soft-delete preferido sobre `delete` directo — los estudiantes acumulan
 * historia (matrículas, sesiones, bitácoras) que no debemos romper.
 */
export async function setStudentStatus(input: { id: string; status: UserStatus }): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = InputSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Datos inválidos" }

  const target = await prisma.user.findFirst({
    where: { id: parsed.data.id, role: "STUDENT" },
  })
  if (!target) return { success: false, error: "Estudiante no encontrado" }

  await prisma.user.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  })

  // Si pasa ACTIVE → INACTIVE: notificar por cortesía y revocar tokens
  // pendientes (activación / reset). Si volviera a entrar via un link viejo
  // sería incongruente con su nuevo estado.
  if (target.status === UserStatus.ACTIVE && parsed.data.status === UserStatus.INACTIVE) {
    await revokeUserTokens(target.id)
    await sendDeactivationEmail({
      userId: target.id,
      email: target.email,
      firstName: target.firstName,
    })
  }

  revalidatePath("/admin/estudiantes")
  revalidatePath(`/admin/estudiantes/${parsed.data.id}`)
  return { success: true }
}
