"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { ApplicationFormSchema, type ApplicationFormInput } from "./schemas"

type Result =
  | { success: true; id: string }
  | { success: false; error: string; field?: keyof ApplicationFormInput }

/**
 * Edita una postulación existente. Solo se permite mientras esté PENDING —
 * una postulación APPROVED ya creó User/TeacherProfile y editarla aquí
 * desincronizaría perfiles.
 *
 * Estrategia para colecciones (niveles + disponibilidad): delete-all +
 * insert. Es la forma más simple de mantener la verdad del form sin tener
 * que diff-ear; el costo es despreciable para los tamaños esperados (<20
 * filas por postulación).
 */
export async function updateApplication(
  id: string,
  input: ApplicationFormInput,
): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = ApplicationFormSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof ApplicationFormInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const current = await prisma.teacherApplication.findUnique({ where: { id } })
  if (!current) return { success: false, error: "Postulación no encontrada" }
  if (current.status !== "PENDING") {
    return {
      success: false,
      error: "Solo se pueden editar postulaciones pendientes",
    }
  }

  // Si cambió el email, validar de nuevo contra User y otras postulaciones PENDING.
  if (data.email !== current.email) {
    const [user, pending] = await Promise.all([
      prisma.user.findUnique({ where: { email: data.email } }),
      prisma.teacherApplication.findFirst({
        where: { email: data.email, status: "PENDING", NOT: { id } },
      }),
    ])
    if (user)
      return {
        success: false,
        error: "Ya existe un usuario con este correo",
        field: "email",
      }
    if (pending)
      return {
        success: false,
        error: "Ya hay otra postulación pendiente con este correo",
        field: "email",
      }
  }

  await prisma.$transaction(async (tx) => {
    await tx.teacherApplication.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        document: data.document,
        bio: data.bio ?? null,
      },
    })
    await tx.teacherApplicationLevel.deleteMany({ where: { applicationId: id } })
    await tx.applicationAvailability.deleteMany({ where: { applicationId: id } })
    if (data.levelIds.length > 0) {
      await tx.teacherApplicationLevel.createMany({
        data: data.levelIds.map((levelId) => ({ applicationId: id, levelId })),
      })
    }
    if (data.availability.length > 0) {
      await tx.applicationAvailability.createMany({
        data: data.availability.map((s) => ({
          applicationId: id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      })
    }
  })

  revalidatePath("/admin/postulaciones")
  return { success: true, id }
}
