"use server"

import { revalidatePath } from "next/cache"
import { Role, UserStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { issueAndSendActivation } from "@/modules/auth/emails"
import { NewTeacherSchema, type NewTeacherInput } from "./schemas"

type Result =
  | { success: true; teacherId: string }
  | { success: false; error: string; field?: keyof NewTeacherInput }

/**
 * Crea un docente directo desde el panel admin (sin pasar por la postulación
 * pública). El alta crea User + TeacherProfile + TeacherLevel[] +
 * TeacherAvailability[] en una sola transacción.
 *
 * `passwordHash` queda en `null`. Tras crear, se emite un token de
 * activación y se envía email; el docente lo abre y setea su contraseña.
 * Mientras no la setee, no puede iniciar sesión, pero ya aparece para
 * asignaciones.
 */
export async function createTeacher(input: NewTeacherInput): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = NewTeacherSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof NewTeacherInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const conflict = await findUserConflict(data.email, data.document)
  if (conflict) return { success: false, error: conflict.error, field: conflict.field }

  const teacherId = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone ?? null,
        document: data.document ?? null,
        role: Role.TEACHER,
        status: data.status,
      },
    })
    await tx.teacherProfile.create({
      data: {
        userId: user.id,
        hireDate: new Date(),
        // La tarifa rige a nivel administración (no por docente). Mantenemos
        // el campo en 0 hasta que la pantalla de Configuración / Tarifario
        // sea la fuente de verdad para el snapshot al cerrar clase.
        hourlyRate: 0,
        isActive: data.status === UserStatus.ACTIVE,
      },
    })
    if (data.levelIds.length > 0) {
      await tx.teacherLevel.createMany({
        data: data.levelIds.map((levelId) => ({
          teacherId: user.id,
          levelId,
        })),
      })
    }
    if (data.blocks.length > 0) {
      await tx.teacherAvailability.createMany({
        data: data.blocks.map((b) => ({
          teacherId: user.id,
          dayOfWeek: b.dayOfWeek,
          startTime: b.startTime,
          endTime: b.endTime,
        })),
      })
    }
    return user.id
  })

  // Email de activación — fuera de la transacción. Si falla, el alta sigue
  // siendo válida y el admin puede regenerar el enlace desde el detalle.
  await issueAndSendActivation({
    userId: teacherId,
    email: data.email,
    firstName: data.firstName,
  })

  revalidatePath("/admin/docentes")
  return { success: true, teacherId }
}

async function findUserConflict(
  email: string,
  document: string | undefined,
): Promise<{ error: string; field: keyof NewTeacherInput } | null> {
  const [byEmail, byDoc] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    document ? prisma.user.findUnique({ where: { document } }) : Promise.resolve(null),
  ])
  if (byEmail) return { error: "Ya existe un usuario con este correo", field: "email" }
  if (byDoc) return { error: "Ya existe un usuario con este documento", field: "document" }
  return null
}
