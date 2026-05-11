"use server"

import { revalidatePath } from "next/cache"
import { EnrollmentStatus, Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { issueAndSendActivation } from "@/modules/auth/emails"
import { NewStudentWithEnrollmentSchema, type NewStudentWithEnrollmentInput } from "./schemas"

type Result =
  | {
      success: true
      studentId: string
      enrollmentId: string
    }
  | {
      success: false
      error: string
      field?: keyof NewStudentWithEnrollmentInput
    }

/**
 * Alta de estudiante con su primera matrícula y horario preferido.
 *
 * Modelo del flujo:
 *   - La matrícula se crea SIEMPRE en "espera de aula" (`classGroupId` =
 *     null). La asignación a un aula existente, o la creación de un aula
 *     nueva con este alumno adentro, se hace desde `/admin/aulas/...`.
 *   - El horario preferido se persiste en `StudentPreferredSchedule` dentro
 *     de la misma transacción que User + StudentProfile + Enrollment.
 *
 * El email de activación se dispara después del commit; un fallo del SMTP
 * no rompe el alta (el retry job lo levanta).
 */
export async function createStudentWithEnrollment(
  input: NewStudentWithEnrollmentInput,
): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = NewStudentWithEnrollmentSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof NewStudentWithEnrollmentInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  // -----------------------------------------------------------------------
  //  Conflictos de identidad: email único, doc único.
  // -----------------------------------------------------------------------
  const conflict = await findUserConflict(data.email, data.document)
  if (conflict) return { success: false, ...conflict }

  // -----------------------------------------------------------------------
  //  Validar nivel.
  // -----------------------------------------------------------------------
  const programLevel = await prisma.programLevel.findUnique({
    where: { id: data.programLevelId },
    select: { id: true },
  })
  if (!programLevel) {
    return {
      success: false,
      error: "Nivel no encontrado",
      field: "programLevelId",
    }
  }

  // -----------------------------------------------------------------------
  //  Transacción: User + StudentProfile + PreferredSchedule + Enrollment.
  // -----------------------------------------------------------------------
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone ?? null,
        document: data.document ?? null,
        role: Role.STUDENT,
        status: data.status,
      },
    })

    await tx.studentProfile.create({
      data: {
        userId: user.id,
        company: data.company ?? null,
        position: data.position ?? null,
        notes: data.studentNotes ?? null,
      },
    })

    if (data.preferredSchedule.length > 0) {
      await tx.studentPreferredSchedule.createMany({
        data: data.preferredSchedule.map((b) => ({
          studentId: user.id,
          dayOfWeek: b.dayOfWeek,
          startTime: b.startTime,
          endTime: b.endTime,
        })),
      })
    }

    const enrollment = await tx.enrollment.create({
      data: {
        studentId: user.id,
        programLevelId: data.programLevelId,
        modality: data.modality,
        status: EnrollmentStatus.ACTIVE,
        notes: data.enrollmentNotes ?? null,
      },
    })

    return { studentId: user.id, enrollmentId: enrollment.id }
  })

  // -----------------------------------------------------------------------
  //  Email de activación — fuera de la transacción.
  // -----------------------------------------------------------------------
  await issueAndSendActivation({
    userId: created.studentId,
    email: data.email,
    firstName: data.firstName,
  })

  revalidatePath("/admin/estudiantes")
  revalidatePath(`/admin/estudiantes/${created.studentId}`)
  return { success: true, ...created }
}

// -----------------------------------------------------------------------------
//  Helpers
// -----------------------------------------------------------------------------

async function findUserConflict(
  email: string,
  document: string | undefined,
): Promise<{
  error: string
  field: keyof NewStudentWithEnrollmentInput
} | null> {
  const [byEmail, byDoc] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    document ? prisma.user.findUnique({ where: { document } }) : Promise.resolve(null),
  ])
  if (byEmail) {
    return { error: "Ya existe un usuario con este correo", field: "email" }
  }
  if (byDoc) {
    return { error: "Ya existe un usuario con este documento", field: "document" }
  }
  return null
}
