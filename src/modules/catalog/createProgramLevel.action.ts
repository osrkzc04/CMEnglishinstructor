"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import {
  ProgramLevelInputSchema,
  type ProgramLevelInput,
} from "./schemas"

type Result =
  | { success: true; id: string }
  | { success: false; error: string; field?: keyof ProgramLevelInput }

export async function createProgramLevel(
  input: ProgramLevelInput,
): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = ProgramLevelInputSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof ProgramLevelInput | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const program = await prisma.program.findUnique({
    where: { id: data.programId },
    select: { id: true },
  })
  if (!program) {
    return { success: false, error: "Programa no encontrado", field: "programId" }
  }

  const conflict = await prisma.programLevel.findUnique({
    where: { programId_code: { programId: data.programId, code: data.code } },
    select: { id: true },
  })
  if (conflict) {
    return {
      success: false,
      error: "Ya hay un nivel con ese código en el programa",
      field: "code",
    }
  }

  const created = await prisma.programLevel.create({
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
    select: { id: true },
  })

  revalidatePath("/admin/configuracion/niveles")
  return { success: true, id: created.id }
}
