"use server"

import { revalidatePath } from "next/cache"
import { ApplicationStatus } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
// import { sendApplicationRejectedEmail } from "./emails"

/**
 * Rechaza una postulación. El motivo queda guardado en
 * `rejectionReason` para audit interno.
 *
 * Por decisión del producto, el rechazo NO envía email al postulante por
 * ahora. La función `sendApplicationRejectedEmail` ya está definida en
 * `./emails.ts`; cuando el negocio decida activar la notificación, basta
 * con descomentar el import + el bloque del envío al final de esta
 * action (después del commit de la transacción).
 */

const RejectInputSchema = z.object({
  rejectionReason: z
    .string()
    .trim()
    .min(10, "El motivo debe tener al menos 10 caracteres")
    .max(2000, "Máximo 2000 caracteres"),
})

export type RejectApplicationInput = z.infer<typeof RejectInputSchema>

type Result = { success: true } | { success: false; error: string }

export async function rejectApplication(
  applicationId: string,
  input: RejectApplicationInput,
): Promise<Result> {
  const reviewer = await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = RejectInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    }
  }

  const current = await prisma.teacherApplication.findUnique({
    where: { id: applicationId },
    select: { status: true },
  })
  if (!current) return { success: false, error: "Postulación no encontrada" }
  if (current.status !== ApplicationStatus.PENDING) {
    return {
      success: false,
      error: "Solo se pueden rechazar postulaciones pendientes",
    }
  }

  await prisma.teacherApplication.update({
    where: { id: applicationId },
    data: {
      status: ApplicationStatus.REJECTED,
      reviewedBy: reviewer.id ?? null,
      reviewedAt: new Date(),
      rejectionReason: parsed.data.rejectionReason,
    },
  })

  // Hook de notificación — desactivado por decisión del producto. Activar
  // descomentando este bloque y el import de `sendApplicationRejectedEmail`.
  // const app = await prisma.teacherApplication.findUnique({
  //   where: { id: applicationId },
  //   select: { email: true, firstName: true },
  // })
  // if (app) {
  //   void sendApplicationRejectedEmail({
  //     applicationId,
  //     email: app.email,
  //     firstName: app.firstName,
  //     reason: parsed.data.rejectionReason,
  //   }).catch(() => {})
  // }

  revalidatePath("/admin/postulaciones")
  revalidatePath(`/admin/postulaciones/${applicationId}`)
  return { success: true }
}
