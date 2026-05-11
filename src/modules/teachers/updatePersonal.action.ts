"use server"

import { revalidatePath } from "next/cache"
import { UserStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import {
  TeacherPersonalDataSchema,
  type TeacherPersonalDataInput,
} from "./schemas"

type Result =
  | { success: true }
  | {
      success: false
      error: string
      field?: keyof TeacherPersonalDataInput
    }

/**
 * Edita los datos personales + perfil del docente. Mantiene `User.status` y
 * `TeacherProfile.isActive` sincronizados — un docente "Activo" puede recibir
 * asignaciones, "Inactivo" no.
 */
export async function updateTeacherPersonal(
  id: string,
  input: TeacherPersonalDataInput,
): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = TeacherPersonalDataSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof TeacherPersonalDataInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const current = await prisma.user.findFirst({
    where: { id, role: "TEACHER" },
    include: { teacherProfile: true },
  })
  if (!current || !current.teacherProfile) {
    return { success: false, error: "Docente no encontrado" }
  }

  // Validar conflicto si cambió email o documento
  if (data.email !== current.email) {
    const other = await prisma.user.findUnique({ where: { email: data.email } })
    if (other && other.id !== id) {
      return {
        success: false,
        error: "Ya existe un usuario con este correo",
        field: "email",
      }
    }
  }
  if (data.document && data.document !== current.document) {
    const other = await prisma.user.findUnique({
      where: { document: data.document },
    })
    if (other && other.id !== id) {
      return {
        success: false,
        error: "Ya existe un usuario con este documento",
        field: "document",
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone ?? null,
        document: data.document ?? null,
        status: data.status,
      },
    })
    await tx.teacherProfile.update({
      where: { userId: id },
      data: {
        isActive: data.status === UserStatus.ACTIVE,
      },
    })
  })

  revalidatePath("/admin/docentes")
  revalidatePath(`/admin/docentes/${id}`)
  return { success: true }
}
