"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"

type Result = { success: true } | { success: false; error: string }

/**
 * Saca una matrícula de un aula. La matrícula queda con `classGroupId =
 * null` ("en espera de aula"); se mantiene el resto de su data intacta.
 *
 * Las `ClassParticipant` de sesiones futuras se borran para que el alumno
 * no aparezca en clases que ya no debería tomar. Las sesiones que ya
 * pasaron quedan intactas (audit trail de asistencia + payroll).
 */
export async function removeEnrollmentFromClassGroup(args: {
  classGroupId: string
  enrollmentId: string
}): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: args.enrollmentId },
    select: { id: true, classGroupId: true },
  })
  if (!enrollment) return { success: false, error: "Matrícula no encontrada" }
  if (enrollment.classGroupId !== args.classGroupId) {
    return {
      success: false,
      error: "La matrícula no pertenece a esta aula",
    }
  }

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.classParticipant.deleteMany({
      where: {
        enrollmentId: args.enrollmentId,
        session: {
          classGroupId: args.classGroupId,
          status: "SCHEDULED",
          scheduledStart: { gt: now },
        },
      },
    })

    await tx.enrollment.update({
      where: { id: args.enrollmentId },
      data: { classGroupId: null },
    })
  })

  revalidatePath(`/admin/aulas/${args.classGroupId}`)
  revalidatePath("/admin/aulas")
  return { success: true }
}
