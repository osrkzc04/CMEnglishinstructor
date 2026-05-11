"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { StudentFormSchema, type StudentFormInput } from "./schemas"

type Result =
  | { success: true; id: string }
  | { success: false; error: string; field?: keyof StudentFormInput }

/**
 * Actualiza un estudiante existente. Garantiza que el target sea User con
 * rol STUDENT.
 *
 * StudentProfile se upsertea: aunque el flow normal lo crea en `create`, no
 * podemos asumir que existe (estudiantes preexistentes pudieron migrar sin
 * profile). Esto hace la action robusta a esos casos.
 */
export async function updateStudent(id: string, input: StudentFormInput): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = StudentFormSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof StudentFormInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const current = await prisma.user.findFirst({
    where: { id, role: "STUDENT" },
  })
  if (!current) return { success: false, error: "Estudiante no encontrado" }

  if (data.email !== current.email) {
    const dupe = await prisma.user.findUnique({ where: { email: data.email } })
    if (dupe)
      return {
        success: false,
        error: "Ya existe un usuario con este correo",
        field: "email",
      }
  }
  if (data.document && data.document !== current.document) {
    const dupe = await prisma.user.findUnique({
      where: { document: data.document },
    })
    if (dupe)
      return {
        success: false,
        error: "Ya existe un usuario con este documento",
        field: "document",
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

    await tx.studentProfile.upsert({
      where: { userId: id },
      update: {
        company: data.company ?? null,
        position: data.position ?? null,
        notes: data.notes ?? null,
      },
      create: {
        userId: id,
        company: data.company ?? null,
        position: data.position ?? null,
        notes: data.notes ?? null,
      },
    })
  })

  revalidatePath("/admin/estudiantes")
  revalidatePath(`/admin/estudiantes/${id}`)
  return { success: true, id }
}
