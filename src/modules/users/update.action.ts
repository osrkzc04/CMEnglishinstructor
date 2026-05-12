"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { StaffFormSchema, type StaffFormInput } from "./schemas"
import { countActiveDirectors } from "./queries"

type Result =
  | { success: true; id: string }
  | { success: false; error: string; field?: keyof StaffFormInput }

/**
 * Edita un usuario staff. Solo DIRECTOR. Garantiza que:
 *   - El target sea staff (DIRECTOR / COORDINATOR) — no se puede editar un
 *     STUDENT o TEACHER desde este flujo.
 *   - No se quede el sistema sin un DIRECTOR ACTIVE: si el cambio implica
 *     bajar a INACTIVE o cambiar el rol del último director activo, se
 *     bloquea.
 *   - El director conectado no se cambie su propio rol ni se desactive a sí
 *     mismo (queda fuera del panel y no podría arreglar el error).
 */
export async function updateStaffUser(id: string, input: StaffFormInput): Promise<Result> {
  await requireRole(["DIRECTOR"])

  const parsed = StaffFormSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof StaffFormInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const current = await prisma.user.findFirst({
    where: { id, role: { in: ["DIRECTOR", "COORDINATOR"] } },
  })
  if (!current) return { success: false, error: "Usuario no encontrado" }

  // Auto-protección: no permitir que el director conectado se desactive a
  // sí mismo o cambie su propio rol — quedaría sin acceso y sin forma de
  // revertirlo.
  const session = await auth()
  const isSelf = session?.user?.id === id
  if (isSelf) {
    if (data.role !== current.role) {
      return {
        success: false,
        error: "No puedes cambiar tu propio rol",
        field: "role",
      }
    }
    if (data.status !== "ACTIVE") {
      return {
        success: false,
        error: "No puedes desactivar tu propia cuenta",
        field: "status",
      }
    }
  }

  // Protección del último director activo.
  const wasActiveDirector = current.role === "DIRECTOR" && current.status === "ACTIVE"
  const willBeActiveDirector = data.role === "DIRECTOR" && data.status === "ACTIVE"
  if (wasActiveDirector && !willBeActiveDirector) {
    const others = await countActiveDirectors(current.id)
    if (others === 0) {
      return {
        success: false,
        error: "No puedes dejar al sistema sin un director activo",
        field: data.role !== "DIRECTOR" ? "role" : "status",
      }
    }
  }

  if (data.email !== current.email) {
    const dupe = await prisma.user.findUnique({ where: { email: data.email } })
    if (dupe) {
      return {
        success: false,
        error: "Ya existe un usuario con este correo",
        field: "email",
      }
    }
  }
  if (data.document && data.document !== current.document) {
    const dupe = await prisma.user.findUnique({ where: { document: data.document } })
    if (dupe) {
      return {
        success: false,
        error: "Ya existe un usuario con este documento",
        field: "document",
      }
    }
  }

  await prisma.user.update({
    where: { id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone ?? null,
      document: data.document ?? null,
      role: data.role,
      status: data.status,
    },
  })

  revalidatePath("/admin/usuarios")
  revalidatePath(`/admin/usuarios/${id}`)
  return { success: true, id }
}
