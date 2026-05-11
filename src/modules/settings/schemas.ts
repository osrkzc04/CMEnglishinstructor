import { z } from "zod"

/**
 * Validación del form de "Parámetros del sistema" (`/admin/configuracion/sistema`).
 *
 * Todas las claves del schema mapean 1:1 a entries del registry en
 * `src/modules/settings/index.ts`. Mantenerlas alineadas — si se agrega un
 * setting al registry, agregarlo también acá para que el form lo cubra.
 *
 * Reglas de rangos:
 *  - `classDefaultDurationMinutes`: 15-180. Bajo 15 no es viable
 *    pedagógicamente; sobre 180 (3 h) es atípico para clase de idioma.
 *  - `weeklyMinHours` / `weeklyMaxHours`: enteros 1-40. Validación cruzada
 *    (max ≥ min) corre en la action porque depende de ambos campos.
 *  - `absenceCountsAsConsumed`: boolean simple.
 *
 * `z.coerce.number()` es importante: los inputs HTML devuelven strings,
 * y RHF + zodResolver los pasa tal cual. Con coerce el string "60" se
 * convierte a 60 antes de validar el rango.
 */

export const SystemSettingsSchema = z.object({
  classDefaultDurationMinutes: z.coerce
    .number({ invalid_type_error: "Debe ser un número" })
    .int("Debe ser un número entero")
    .min(15, "Mínimo 15 minutos")
    .max(180, "Máximo 180 minutos"),
  weeklyMinHours: z.coerce
    .number({ invalid_type_error: "Debe ser un número" })
    .int("Debe ser un número entero")
    .min(1, "Mínimo 1 hora")
    .max(40, "Máximo 40 horas"),
  weeklyMaxHours: z.coerce
    .number({ invalid_type_error: "Debe ser un número" })
    .int("Debe ser un número entero")
    .min(1, "Mínimo 1 hora")
    .max(40, "Máximo 40 horas"),
  absenceCountsAsConsumed: z.boolean(),
})

export type SystemSettingsInput = z.infer<typeof SystemSettingsSchema>
