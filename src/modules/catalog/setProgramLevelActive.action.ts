"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import {
  SetProgramLevelActiveSchema,
  type SetProgramLevelActiveInput,
} from "./schemas"

type Result = { success: true } | { success: false; error: string }

/**
 * Activa o desactiva un nivel. Desactivar lo esconde de los pickers (alta
 * de aula, alta de estudiante con matrícula); las matrículas y aulas
 * existentes siguen funcionando.
 *
 * Reactivar es seguro siempre — solo vuelve a aparecer en los pickers.
 */
export async function setProgramLevelActive(
  id: string,
  input: SetProgramLevelActiveInput,
): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = SetProgramLevelActiveSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const data = parsed.data

  const exists = await prisma.programLevel.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!exists) return { success: false, error: "Nivel no encontrado" }

  await prisma.programLevel.update({
    where: { id },
    data: { isActive: data.isActive },
  })

  revalidatePath("/admin/configuracion/niveles")
  return { success: true }
}
