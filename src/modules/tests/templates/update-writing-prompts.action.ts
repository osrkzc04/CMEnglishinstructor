"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireRole } from "@/modules/auth/guards"
import {
  UpdateWritingPromptsSchema,
  type UpdateWritingPromptsInput,
} from "./schemas"

/**
 * Actualiza los `writingPrompt` por sección de una plantilla. Se ejecuta
 * en una sola transacción — todas las secciones se actualizan en bloque o
 * ninguna.
 *
 * Roles permitidos: DIRECTOR / COORDINATOR. La consigna NO se snapshotea
 * acá; vive snapshoteada en `TestSession.writingPromptSnapshot` cuando el
 * candidato la recibe, así futuras ediciones no contaminan exámenes ya
 * rendidos.
 */

export type UpdateWritingPromptsResult =
  | { success: true; updatedCount: number }
  | { success: false; error: string }

export async function updateWritingPrompts(
  input: UpdateWritingPromptsInput,
): Promise<UpdateWritingPromptsResult> {
  try {
    await requireRole(["DIRECTOR", "COORDINATOR"])
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { success: false, error: "Sin permisos para editar plantillas" }
    }
    throw err
  }

  const parsed = UpdateWritingPromptsSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { success: false, error: first?.message ?? "Datos inválidos" }
  }
  const data = parsed.data

  // Validar que todas las secciones realmente pertenecen al template
  // declarado. Defensa contra payloads manipulados — el form de UI nunca
  // mezcla templates.
  const existing = await prisma.testTemplateSection.findMany({
    where: { templateId: data.templateId, id: { in: data.sections.map((s) => s.sectionId) } },
    select: { id: true },
  })
  const validIds = new Set(existing.map((e) => e.id))
  if (validIds.size !== data.sections.length) {
    return { success: false, error: "Una o más secciones no pertenecen a la plantilla" }
  }

  await prisma.$transaction(
    data.sections.map((s) =>
      prisma.testTemplateSection.update({
        where: { id: s.sectionId },
        data: { writingPrompt: s.writingPrompt },
      }),
    ),
  )

  revalidatePath("/admin/preguntas")
  revalidatePath("/admin/preguntas/[levelCode]", "page")

  return { success: true, updatedCount: data.sections.length }
}
