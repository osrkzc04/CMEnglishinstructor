import { z } from "zod"

/**
 * Validaciones del catálogo (cursos / programas / niveles). Por ahora solo
 * niveles — los demás CRUDs llegan en fases siguientes.
 */

const codeRegex = /^[A-Za-z0-9._\- ]+$/

export const ProgramLevelInputSchema = z.object({
  programId: z.string().cuid("Programa inválido"),
  code: z
    .string()
    .trim()
    .min(1, "Código requerido")
    .max(40, "Máximo 40 caracteres")
    .refine((v) => codeRegex.test(v), {
      message: "Solo letras, números, espacios, punto, guión y guión bajo",
    }),
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(120, "Máximo 120 caracteres"),
  order: z.coerce.number().int().min(0).max(999),
  cefrLevelCode: z
    .string()
    .trim()
    .max(10)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  totalHours: z.coerce.number().min(1, "Mínimo 1 hora").max(1000, "Máximo 1000 horas"),
  hasPlatformAccess: z.boolean().default(true),
  hasPdfMaterial: z.boolean().default(true),
})
export type ProgramLevelInput = z.infer<typeof ProgramLevelInputSchema>

export const ProgramLevelUpdateSchema = ProgramLevelInputSchema
export type ProgramLevelUpdateInput = z.infer<typeof ProgramLevelUpdateSchema>

export const SetProgramLevelActiveSchema = z.object({
  isActive: z.boolean(),
})
export type SetProgramLevelActiveInput = z.infer<typeof SetProgramLevelActiveSchema>
