"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/modules/auth/guards"
import {
  materializeClassSessions,
  type MaterializeResult,
} from "./materialize"

const InputSchema = z
  .object({
    classGroupId: z.string().cuid("Aula inválida"),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inicial inválida"),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha final inválida"),
  })
  .refine((d) => d.fromDate <= d.toDate, {
    message: "El rango es inválido (fin antes que inicio)",
    path: ["toDate"],
  })

export type MaterializeRangeInput = z.infer<typeof InputSchema>

type Result =
  | { success: true; counters: MaterializeResult }
  | { success: false; error: string }

const ERROR_MESSAGES = {
  group_not_found: "Aula no encontrada",
  group_not_active: "El aula no está activa — no se programan sesiones",
  no_active_teacher: "El aula no tiene docente vigente — asignalo primero",
  invalid_range: "El rango de fechas es inválido",
} as const

/**
 * Programa las sesiones del aula en el rango solicitado. Idempotente —
 * si ya existían sesiones para esos días, se mantienen y se cuentan como
 * "ya existía". Saltea holidays y unavailability del docente vigente.
 */
export async function materializeRange(
  input: MaterializeRangeInput,
): Promise<Result> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = InputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const data = parsed.data

  // Timeout generoso: cada sesión + sus participantes son inserts secuenciales
  // contra Neon. Un aula con 5 slots × 4 semanas × N alumnos puede pasarse
  // del default de 5s. La materialización es idempotente, así que reintentar
  // tras un timeout es seguro — pero preferimos no llegar a ese punto.
  const outcome = await prisma.$transaction(
    async (tx) => {
      return materializeClassSessions(tx, data)
    },
    { maxWait: 10_000, timeout: 60_000 },
  )

  if ("kind" in outcome) {
    return { success: false, error: ERROR_MESSAGES[outcome.kind] }
  }

  revalidatePath(`/admin/aulas/${data.classGroupId}`)
  return { success: true, counters: outcome }
}
