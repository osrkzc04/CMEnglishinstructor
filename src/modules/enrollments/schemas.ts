import { z } from "zod"
import { Modality } from "@prisma/client"

/**
 * Validación de la matrícula. La matrícula es ligera: define a qué
 * `ProgramLevel` se compromete el estudiante, en qué modalidad, y
 * opcionalmente la asignación inicial a un `ClassGroup`.
 *
 * Slots y docente NO viven acá — son del aula. Si el flow de inscripción
 * crea aula y matrícula juntos, los datos del aula se validan con su
 * propio schema (`modules/classGroups/schemas.ts`).
 */

export const NewEnrollmentSchema = z.object({
  studentId: z.string().cuid("Estudiante inválido"),
  programLevelId: z.string().cuid("Nivel inválido"),
  modality: z.nativeEnum(Modality),
  classGroupId: z.string().cuid("Aula inválida").optional(),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
})

export type NewEnrollmentInput = z.infer<typeof NewEnrollmentSchema>
