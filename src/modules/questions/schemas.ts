import { z } from "zod"
import { QuestionType } from "@prisma/client"

/**
 * Schemas Zod del módulo de preguntas — listado + alta/edición.
 *
 * Reglas duras del alta:
 *  - MC: ≥2 opciones, ≥1 correcta, sin opciones vacías.
 *  - FILL_IN: ≥1 respuesta aceptada, sin respuestas vacías.
 *
 * El nivel CEFR se decide desde la URL (`/admin/preguntas/[levelCode]`),
 * no se elige dentro del form — esto evita pifias de "creé en B2 sin querer".
 */

export const QuestionStatusFilterSchema = z.enum(["ALL", "ACTIVE", "INACTIVE"])
export type QuestionStatusFilter = z.infer<typeof QuestionStatusFilterSchema>

export const QuestionListFiltersSchema = z.object({
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  // CEFR level (id de DB, no el code). Si se omite, se devuelven preguntas de
  // todos los niveles del idioma seleccionado.
  levelId: z.string().cuid().optional(),
  type: z.nativeEnum(QuestionType).optional(),
  topic: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  status: QuestionStatusFilterSchema.default("ACTIVE"),
  // Idioma — necesario porque las queries operan por idioma. Si se omite,
  // el caller usa el idioma por defecto (English) del catálogo.
  languageId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(15),
})

export type QuestionListFilters = z.infer<typeof QuestionListFiltersSchema>

// -----------------------------------------------------------------------------
//  Alta / edición de pregunta
// -----------------------------------------------------------------------------

const PromptSchema = z
  .string()
  .trim()
  .min(5, "El enunciado es muy corto")
  .max(2000, "Máximo 2000 caracteres")

const TopicSchema = z
  .string()
  .trim()
  .max(80, "Máximo 80 caracteres")
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))

const OptionInputSchema = z.object({
  text: z.string().trim().min(1, "Texto requerido").max(500, "Máximo 500 caracteres"),
  isCorrect: z.boolean(),
})

const AcceptedAnswerInputSchema = z.object({
  answer: z.string().trim().min(1, "Respuesta requerida").max(200, "Máximo 200 caracteres"),
  caseSensitive: z.boolean(),
})

const BaseQuestionFields = {
  levelId: z.string().cuid("Nivel inválido"),
  prompt: PromptSchema,
  type: z.nativeEnum(QuestionType),
  topic: TopicSchema,
  difficulty: z.coerce.number().int().min(1).max(3).default(1),
  points: z.coerce.number().int().min(1).max(10).default(1),
  options: z.array(OptionInputSchema).default([]),
  acceptedAnswers: z.array(AcceptedAnswerInputSchema).default([]),
}

function refineByType(
  data: {
    type: QuestionType
    options: { text: string; isCorrect: boolean }[]
    acceptedAnswers: { answer: string; caseSensitive: boolean }[]
  },
  ctx: z.RefinementCtx,
) {
  if (data.type === QuestionType.MULTIPLE_CHOICE) {
    if (data.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Las preguntas de opción múltiple necesitan al menos 2 opciones",
      })
    }
    if (data.options.length > 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Máximo 6 opciones por pregunta",
      })
    }
    const correctCount = data.options.filter((o) => o.isCorrect).length
    if (correctCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Marca al menos una opción como correcta",
      })
    }
  }
  if (data.type === QuestionType.FILL_IN) {
    if (data.acceptedAnswers.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["acceptedAnswers"],
        message: "Las preguntas de completar necesitan al menos una respuesta aceptada",
      })
    }
    if (data.acceptedAnswers.length > 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["acceptedAnswers"],
        message: "Máximo 6 respuestas aceptadas",
      })
    }
  }
}

export const NewQuestionSchema = z.object(BaseQuestionFields).superRefine(refineByType)
export type NewQuestionInput = z.infer<typeof NewQuestionSchema>

export const UpdateQuestionSchema = z
  .object({
    id: z.string().cuid(),
    ...BaseQuestionFields,
  })
  .superRefine(refineByType)
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>

// -----------------------------------------------------------------------------
//  Activar / desactivar
// -----------------------------------------------------------------------------

export const SetQuestionActiveSchema = z.object({
  id: z.string().cuid(),
  isActive: z.boolean(),
})
export type SetQuestionActiveInput = z.infer<typeof SetQuestionActiveSchema>
