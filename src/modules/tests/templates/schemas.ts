import { z } from "zod"

/**
 * Schemas Zod compartidos para la edición de plantillas de prueba.
 * Por ahora solo cubrimos la edición del `writingPrompt` por sección.
 */

export const UpdateWritingPromptsSchema = z.object({
  templateId: z.string().cuid("Plantilla inválida"),
  // Cada entrada del array es { sectionId, writingPrompt }. Permitimos
  // writingPrompt vacío → null (limpieza). 8000 chars máximo, mismo límite
  // que el `prompt` de pregunta para que el snapshot quepa.
  sections: z
    .array(
      z.object({
        sectionId: z.string().cuid("Sección inválida"),
        writingPrompt: z
          .string()
          .max(8000, "Máximo 8000 caracteres")
          .transform((v) => v.trim())
          .transform((v) => (v.length === 0 ? null : v))
          .nullable(),
      }),
    )
    .min(1, "Debe enviar al menos una sección"),
})

export type UpdateWritingPromptsInput = z.infer<typeof UpdateWritingPromptsSchema>
