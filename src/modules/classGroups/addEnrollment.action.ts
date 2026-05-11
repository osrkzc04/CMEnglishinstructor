"use server"

import { revalidatePath } from "next/cache"
import { ClassGroupStatus, EnrollmentStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { attachEnrollmentToFutureSessions } from "./materialize"
import { notifyClassGroupAssignment } from "./emails"

type Result = { success: true; addedToSessions: number } | { success: false; error: string }

/**
 * Suma una matrícula a un aula. Reglas:
 *  - El aula debe estar ACTIVE.
 *  - La matrícula debe estar ACTIVE y no pertenecer a otra aula.
 *  - El `programLevelId` de la matrícula debe coincidir con el del aula
 *    (regla "no mezclar niveles").
 *
 * Si el aula ya tiene sesiones SCHEDULED futuras materializadas, también se
 * crean los `ClassParticipant` correspondientes para que el alumno aparezca
 * en la asistencia desde la próxima clase. Las sesiones pasadas se ignoran.
 */
export async function addEnrollmentToClassGroup(args: {
  classGroupId: string
  enrollmentId: string
}): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const [group, enrollment] = await Promise.all([
    prisma.classGroup.findUnique({
      where: { id: args.classGroupId },
      select: { id: true, programLevelId: true, status: true },
    }),
    prisma.enrollment.findUnique({
      where: { id: args.enrollmentId },
      select: {
        id: true,
        studentId: true,
        programLevelId: true,
        classGroupId: true,
        status: true,
      },
    }),
  ])

  if (!group) return { success: false, error: "Aula no encontrada" }
  if (group.status !== ClassGroupStatus.ACTIVE) {
    return { success: false, error: "El aula no está activa" }
  }
  if (!enrollment) return { success: false, error: "Matrícula no encontrada" }
  if (enrollment.status !== EnrollmentStatus.ACTIVE) {
    return { success: false, error: "Solo se pueden sumar matrículas activas" }
  }
  if (enrollment.classGroupId && enrollment.classGroupId !== group.id) {
    return {
      success: false,
      error: "La matrícula ya pertenece a otra aula",
    }
  }
  if (enrollment.programLevelId !== group.programLevelId) {
    return {
      success: false,
      error: "El nivel de la matrícula no coincide con el del aula",
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.enrollment.update({
      where: { id: args.enrollmentId },
      data: { classGroupId: args.classGroupId },
    })
    return attachEnrollmentToFutureSessions(tx, {
      classGroupId: args.classGroupId,
      enrollmentId: args.enrollmentId,
    })
  })

  // Notificar al nuevo alumno (solo si el aula tiene docente vigente —
  // si todavía no, el `notifyClassGroupAssignment` devuelve sin hacer nada
  // porque el snapshot requiere docente).
  await notifyClassGroupAssignment({
    classGroupId: args.classGroupId,
    teacherIncluded: false,
    studentIds: [enrollment.studentId],
  })

  revalidatePath(`/admin/aulas/${args.classGroupId}`)
  revalidatePath("/admin/aulas")
  return { success: true, addedToSessions: result.created }
}
