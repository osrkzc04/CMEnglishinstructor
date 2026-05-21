import { z } from "zod"

/**
 * Schemas Zod del módulo de grading. Vivo aparte del action porque los
 * archivos con `"use server"` solo pueden exportar funciones async — los
 * schemas y los tipos van en un archivo neutral que tanto cliente como
 * servidor pueden importar.
 */

export const ManualReviewInputSchema = z.object({
  sessionId: z.string().min(1),
  reading: z.coerce.number().min(0).max(100).nullable().optional(),
  writing: z.coerce.number().min(0).max(100).nullable().optional(),
  listening: z.coerce.number().min(0).max(100).nullable().optional(),
  speaking: z.coerce.number().min(0).max(100).nullable().optional(),
  assignedLevelId: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  reviewerNotes: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
})

export type ManualReviewInput = z.infer<typeof ManualReviewInputSchema>

export type ManualReviewResult =
  | { success: true; sessionId: string; resultsLink: string; emailQueued: boolean }
  | { success: false; error: string }
