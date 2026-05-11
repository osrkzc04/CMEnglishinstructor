"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import { ProgramLevelUpdateSchema, type ProgramLevelUpdateInput } from "./schemas"

type Result =
  | { success: true }
  | {
      success: false
      error: string
      field?: keyof ProgramLevelUpdateInput
    }

/**
 * Edita un nivel. Cambiar el `programId` está permitido pero no es típico —
 * mover un nivel entre programas no rompe historia (las matrículas referencian
 * por id), aunque la UI por simplicidad lo deshabilita en el form.
 *
 * `totalHours` se puede cambiar incluso con matrículas activas: el saldo
 * mostrado al estudiante se recalcula contra el nuevo número. No se mueve
 * `consumedHours` (es histórico de horas dictadas, no del contrato).
 */
export async function updateProgramLevel(
  id: string,
  input: ProgramLevelUpdateInput,
): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = ProgramLevelUpdateSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof ProgramLevelUpdateInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const existing = await prisma.programLevel.findUnique({
    where: { id },
    select: { id: true, programId: true, code: true },
  })
  if (!existing) return { success: false, error: "Nivel no encontrado" }

  // Conflicto de unicidad solo si cambió programId o code
  if (existing.programId !== data.programId || existing.code !== data.code) {
    const conflict = await prisma.programLevel.findUnique({
      where: { programId_code: { programId: data.programId, code: data.code } },
      select: { id: true },
    })
    if (conflict && conflict.id !== id) {
      return {
        success: false,
        error: "Ya hay un nivel con ese código en el programa",
        field: "code",
      }
    }
  }

  await prisma.programLevel.update({
    where: { id },
    data: {
      programId: data.programId,
      code: data.code,
      name: data.name,
      order: data.order,
      cefrLevelCode: data.cefrLevelCode ?? null,
      totalHours: data.totalHours,
      hasPlatformAccess: data.hasPlatformAccess,
      hasPdfMaterial: data.hasPdfMaterial,
    },
  })

  revalidatePath("/admin/configuracion/niveles")
  return { success: true }
}
