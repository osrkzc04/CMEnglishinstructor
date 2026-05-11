import { z } from "zod"
import { ApplicationStatus } from "@prisma/client"

/**
 * Validación de TeacherApplication para el panel del admin.
 *
 * El form público (/postular-docente) podrá compartir estos schemas más
 * adelante. Por ahora cubrimos el caso "el coordinador ingresa una
 * postulación recibida por teléfono / WhatsApp / mail" + edición de la misma
 * mientras esté PENDING.
 *
 * Las decisiones de aprobación / rechazo viven en flows separados
 * (approve.action.ts, reject.action.ts — pendientes de iteración).
 */

// -----------------------------------------------------------------------------
//  Slot de disponibilidad recurrente — patrón semanal (no DateTime)
// -----------------------------------------------------------------------------

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export const AvailabilitySlotSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(TIME_RE, "Hora inválida (HH:mm)"),
    endTime: z.string().regex(TIME_RE, "Hora inválida (HH:mm)"),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: "La hora final debe ser posterior a la inicial",
    path: ["endTime"],
  })

// -----------------------------------------------------------------------------
//  Schema principal del form (compartido create + update)
// -----------------------------------------------------------------------------

export const ApplicationFormSchema = z.object({
  firstName: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  lastName: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  phone: z.string().trim().min(7, "Teléfono inválido").max(20, "Teléfono inválido"),
  document: z.string().trim().min(6, "Documento inválido").max(20, "Documento inválido"),
  bio: z
    .string()
    .trim()
    .max(2000, "Máximo 2000 caracteres")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  levelIds: z.array(z.string().cuid("ID inválido")).min(1, "Selecciona al menos un nivel"),
  availability: z
    .array(AvailabilitySlotSchema)
    .min(1, "Agrega al menos un bloque de disponibilidad"),
})

export type ApplicationFormInput = z.infer<typeof ApplicationFormSchema>

// -----------------------------------------------------------------------------
//  Filtros del listado (paginación + búsqueda + estado)
// -----------------------------------------------------------------------------

export const ApplicationListFiltersSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  status: z.nativeEnum(ApplicationStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(15),
})

export type ApplicationListFilters = z.infer<typeof ApplicationListFiltersSchema>
