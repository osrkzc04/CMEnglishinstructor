"use server"

import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireRole } from "@/modules/auth/guards"
import { validateImport, type PreviewSummary } from "./import"

/**
 * Server action que recibe el CSV en texto plano, lo valida contra el banco
 * actual del nivel y devuelve la preview con estado por fila.
 *
 * No persiste nada. La acción de commit se llama después con el mismo CSV.
 *
 * Tamaño máximo: 200 KB. Más allá de eso conviene partir el archivo — la
 * validación se procesa entera en memoria.
 */

const MAX_CSV_BYTES = 200_000

export type PreviewImportResult =
  | { success: true; summary: PreviewSummary }
  | { success: false; error: string }

export async function previewImport(input: {
  csvText: string
  levelId: string
}): Promise<PreviewImportResult> {
  try {
    await requireRole(["DIRECTOR", "COORDINATOR"])
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { success: false, error: "Sin permisos para importar preguntas" }
    }
    throw err
  }

  if (typeof input.csvText !== "string" || input.csvText.length === 0) {
    return { success: false, error: "El archivo está vacío" }
  }
  if (input.csvText.length > MAX_CSV_BYTES) {
    return {
      success: false,
      error: `El archivo supera el límite de ${Math.round(MAX_CSV_BYTES / 1000)} KB. Divídelo en lotes más chicos.`,
    }
  }

  const level = await prisma.cefrLevel.findUnique({
    where: { id: input.levelId },
    select: { code: true },
  })
  if (!level) {
    return { success: false, error: "Nivel no encontrado" }
  }

  // Para detectar duplicados: traemos todos los prompts del nivel (activos +
  // inactivos) y los normalizamos a minúsculas. Es un escaneo pero el banco
  // por nivel es pequeño (~50-100 preguntas).
  const existing = await prisma.question.findMany({
    where: { levelId: input.levelId },
    select: { prompt: true },
  })
  const existingPromptsLowercased = new Set(existing.map((q) => q.prompt.trim().toLowerCase()))

  const summary = validateImport(input.csvText, {
    levelCode: level.code,
    existingPromptsLowercased,
  })

  return { success: true, summary }
}
