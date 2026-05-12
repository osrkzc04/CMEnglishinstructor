"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { issueAndSendActivation } from "@/modules/auth/emails"
import { NewStaffSchema, type NewStaffInput } from "./schemas"

type Result =
  | { success: true; id: string }
  | { success: false; error: string; field?: keyof NewStaffInput }

/**
 * Alta de usuario staff (DIRECTOR / COORDINATOR).
 *
 * Solo DIRECTOR puede crear staff — incluida coordinación. La razón es que
 * la creación de un usuario con acceso al panel admin afecta directamente
 * la gobernanza del sistema, y un COORDINATOR no debería poder elevarse a
 * sí mismo ni clonar acceso.
 *
 * Igual que en el flow del estudiante, el email de activación se dispara
 * fuera de la transacción para que un fallo del SMTP no rompa el alta.
 */
export async function createStaffUser(input: NewStaffInput): Promise<Result> {
  await requireRole(["DIRECTOR"])

  const parsed = NewStaffSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof NewStaffInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const conflict = await findUserConflict(data.email, data.document)
  if (conflict) return { success: false, ...conflict }

  const created = await prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone ?? null,
      document: data.document ?? null,
      role: data.role,
      status: data.status,
    },
    select: { id: true },
  })

  // Email de activación — fuera de la transacción.
  if (data.status === "ACTIVE") {
    await issueAndSendActivation({
      userId: created.id,
      email: data.email,
      firstName: data.firstName,
    })
  }

  revalidatePath("/admin/usuarios")
  revalidatePath(`/admin/usuarios/${created.id}`)
  return { success: true, id: created.id }
}

async function findUserConflict(
  email: string,
  document: string | undefined,
): Promise<{ error: string; field: keyof NewStaffInput } | null> {
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
