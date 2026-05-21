import { z } from "zod"

/**
 * Validaciones específicas del módulo de placement test (admin).
 *
 * Se mantiene separado de `invites/` y `grading/` porque acá viven los
 * schemas que comparten admin pages: filtros del listado, editor de plantilla.
 */

export const PlacementListFiltersSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  state: z
    .enum(["PENDING", "IN_PROGRESS", "SUBMITTED", "TIMED_OUT", "REVIEWED", "EXPIRED"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(15),
})

export type PlacementListFilters = z.infer<typeof PlacementListFiltersSchema>

// -----------------------------------------------------------------------------
//  Editor de plantilla (Fase 2+) — la directora ajusta tiempo y umbral por
//  sección. samplePoolSize / questionCount / passingPercent quedan editables.
// -----------------------------------------------------------------------------

export const PlacementSectionEditSchema = z.object({
  id: z.string().min(1).optional(), // null al crear, presente al editar
  levelId: z.string().min(1),
  order: z.coerce.number().int().min(1).max(20),
  samplePoolSize: z.coerce.number().int().min(1).max(500).default(50),
  questionCount: z.coerce.number().int().min(1).max(100).default(20),
  passingPercent: z.coerce.number().int().min(0).max(100).default(90),
})

export const PlacementTemplateEditSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().trim().min(3).max(120),
  timeLimitMinutes: z.coerce.number().int().min(5).max(240),
  instructions: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  sections: z.array(PlacementSectionEditSchema).min(1).max(20),
})

export type PlacementTemplateEditInput = z.infer<typeof PlacementTemplateEditSchema>
