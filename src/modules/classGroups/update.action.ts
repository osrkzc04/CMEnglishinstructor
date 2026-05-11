"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { UpdateClassGroupSchema, type UpdateClassGroupInput } from "./schemas"

type Result =
  | { success: true }
  | { success: false; error: string; field?: keyof UpdateClassGroupInput }

/**
 * Edita metadatos del aula (nombre + notas internas). Slots y docente
 * tienen sus propias actions porque cambios estructurales requieren
 * revalidación de elegibilidad y, eventualmente, re-materialización de
 * sesiones.
 */
export async function updateClassGroup(
  classGroupId: string,
  input: UpdateClassGroupInput,
): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = UpdateClassGroupSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof UpdateClassGroupInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const exists = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    select: { id: true },
  })
  if (!exists) return { success: false, error: "Aula no encontrada" }

  await prisma.classGroup.update({
    where: { id: classGroupId },
    data: {
      name: data.name,
      notes: data.notes ?? null,
      defaultMeetingUrl: data.defaultMeetingUrl ?? null,
      defaultLocation: data.defaultLocation ?? null,
    },
  })

  revalidatePath("/admin/aulas")
  revalidatePath(`/admin/aulas/${classGroupId}`)
  return { success: true }
}
