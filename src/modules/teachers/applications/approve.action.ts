"use server"

import { revalidatePath } from "next/cache"
import { ApplicationStatus, Role, UserStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { issueAndSendActivation } from "@/modules/auth/emails"

type Result = { success: true; teacherId: string } | { success: false; error: string }

/**
 * Aprueba una postulación: la convierte en docente activo y dispara el
 * email de activación.
 *
 * Pasos en transacción:
 *  1. Releer la postulación con sus niveles y disponibilidad propuesta.
 *  2. Validar que esté PENDING (un doble-click no debe duplicar usuarios).
 *  3. Validar que el email/documento no estén tomados por otro User.
 *  4. Crear User (rol TEACHER, status ACTIVE) + TeacherProfile + niveles +
 *     disponibilidad. La tarifa por hora queda en 0 — la fuente de verdad
 *     es la futura pantalla de Configuración / Tarifario; el campo se
 *     mantiene en el modelo por compat con el snapshot al cerrar sesión.
 *  5. Marcar la postulación como APPROVED + linkear `userId`.
 *
 * El email se dispara fuera de la transacción. Si falla (SMTP caído,
 * rate-limit, etc.) la aprobación sigue válida y desde el detalle del
 * docente se puede regenerar el enlace.
 */
export async function approveApplication(applicationId: string): Promise<Result> {
  const reviewer = await requireRole(["DIRECTOR", "COORDINATOR"])

  type CreatedUser = { id: string; email: string; firstName: string }
  let created: CreatedUser
  try {
    created = await prisma.$transaction(async (tx) => {
      const app = await tx.teacherApplication.findUnique({
        where: { id: applicationId },
        include: {
          appliedLevels: true,
          proposedAvailability: true,
        },
      })
      if (!app) throw new Error("Postulación no encontrada")
      if (app.status !== ApplicationStatus.PENDING) {
        throw new Error("Solo se pueden aprobar postulaciones pendientes")
      }

      const [byEmail, byDoc] = await Promise.all([
        tx.user.findUnique({ where: { email: app.email } }),
        tx.user.findUnique({ where: { document: app.document } }),
      ])
      if (byEmail) throw new Error("Ya existe un usuario con este correo")
      if (byDoc) throw new Error("Ya existe un usuario con este documento")

      const user = await tx.user.create({
        data: {
          firstName: app.firstName,
          lastName: app.lastName,
          email: app.email,
          phone: app.phone,
          document: app.document,
          role: Role.TEACHER,
          status: UserStatus.ACTIVE,
        },
      })

      await tx.teacherProfile.create({
        data: {
          userId: user.id,
          hireDate: new Date(),
          hourlyRate: 0,
          bio: app.bio,
          isActive: true,
        },
      })

      if (app.appliedLevels.length > 0) {
        await tx.teacherLevel.createMany({
          data: app.appliedLevels.map((al) => ({
            teacherId: user.id,
            levelId: al.levelId,
          })),
        })
      }

      if (app.proposedAvailability.length > 0) {
        await tx.teacherAvailability.createMany({
          data: app.proposedAvailability.map((a) => ({
            teacherId: user.id,
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
          })),
        })
      }

      await tx.teacherApplication.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.APPROVED,
          reviewedBy: reviewer.id ?? null,
          reviewedAt: new Date(),
          userId: user.id,
        },
      })

      return { id: user.id, email: user.email, firstName: user.firstName }
    })
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo aprobar la postulación",
    }
  }

  await issueAndSendActivation({
    userId: created.id,
    email: created.email,
    firstName: created.firstName,
  })

  revalidatePath("/admin/postulaciones")
  revalidatePath(`/admin/postulaciones/${applicationId}`)
  revalidatePath("/admin/docentes")
  return { success: true, teacherId: created.id }
}
