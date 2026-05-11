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
 * Cambia el estado del docente y mantiene `TeacherProfile.isActive` en
 * sincronía. Soft-delete: nunca borramos el registro porque el docente puede
 * tener bitácoras, asignaciones y registros de payroll asociados.
 */
export async function setTeacherStatus(input: { id: string; status: UserStatus }): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = InputSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Datos inválidos" }

  const target = await prisma.user.findFirst({
    where: { id: parsed.data.id, role: "TEACHER" },
    include: { teacherProfile: true },
  })
  if (!target) return { success: false, error: "Docente no encontrado" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    })
    if (target.teacherProfile) {
      await tx.teacherProfile.update({
        where: { userId: parsed.data.id },
        data: { isActive: parsed.data.status === UserStatus.ACTIVE },
      })
    }
  })

  // Si pasa ACTIVE → INACTIVE: revocar tokens vivos y notificar por cortesía.
  if (target.status === UserStatus.ACTIVE && parsed.data.status === UserStatus.INACTIVE) {
    await revokeUserTokens(target.id)
    await sendDeactivationEmail({
      userId: target.id,
      email: target.email,
      firstName: target.firstName,
    })
  }

  revalidatePath("/admin/docentes")
  revalidatePath(`/admin/docentes/${parsed.data.id}`)
  return { success: true }
}
