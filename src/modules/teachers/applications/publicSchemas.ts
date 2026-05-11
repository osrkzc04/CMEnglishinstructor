import { z } from "zod"
import { AvailabilitySlotSchema } from "./schemas"

/**
 * Validación del form público de postulación de docentes.
 *
 * Difiere del schema admin en:
 *  - `bio` es obligatoria con mínimo 300 caracteres (lo que la coordinación
 *    va a leer para decidir si avanzar a entrevista).
 *  - `consentAccepted` es un literal `true` — sin marcar el checkbox no se
 *    puede enviar el form.
 *  - `turnstileToken` se inyecta desde el widget; si no está, la action lo
 *    rechaza.
 *
 * Usa `AvailabilitySlotSchema` y los criterios de identidad del schema
 * admin, así no divergen las reglas de validación entre canales.
 */

export const PublicApplicationSchema = z.object({
  firstName: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  lastName: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  phone: z
    .string()
    .trim()
    .min(7, "Teléfono inválido")
    .max(20, "Teléfono inválido"),
  document: z
    .string()
    .trim()
    .min(6, "Documento inválido")
    .max(20, "Documento inválido"),
  bio: z
    .string()
    .trim()
    .min(300, "Cuéntanos un poco más sobre tu experiencia (mínimo 300 caracteres)")
    .max(2000, "Máximo 2000 caracteres"),
  levelIds: z
    .array(z.string().cuid("ID inválido"))
    .min(1, "Selecciona al menos un nivel"),
  availability: z
    .array(AvailabilitySlotSchema)
    .min(1, "Agrega al menos un bloque de disponibilidad"),
  consentAccepted: z.literal(true, {
    errorMap: () => ({
      message: "Debes aceptar el uso de tus datos para evaluar la postulación",
    }),
  }),
  turnstileToken: z.string().min(1, "Validación anti-spam pendiente"),
})

export type PublicApplicationInput = z.infer<typeof PublicApplicationSchema>
