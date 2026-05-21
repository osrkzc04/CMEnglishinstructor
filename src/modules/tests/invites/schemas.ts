import { z } from "zod"

/**
 * Validación del alta de candidatos al placement test.
 *
 * Coordinación/Dirección registra al candidato (nombre, correo, doc opcional)
 * y el sistema emite un `InviteToken` con caducidad. El token llega al correo
 * y también queda visible/copiable en el admin por si el email no llega.
 */

export const NewTestInviteSchema = z.object({
  templateId: z.string().min(1, "Selecciona la plantilla del examen"),
  candidateName: z.string().trim().min(2, "Nombre demasiado corto").max(120),
  candidateEmail: z.string().trim().toLowerCase().email("Correo inválido"),
  candidatePhone: z
    .string()
    .trim()
    .max(20, "Teléfono inválido")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  candidateDocument: z
    .string()
    .trim()
    .max(20, "Documento inválido")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  // Caducidad parametrizable — default 24 h. La UI lo deja fijo en 24 h al
  // inicio, queda abierto para que coordinación pueda extender al crear.
  expiresInHours: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 7)
    .default(24),
})

export type NewTestInviteInput = z.infer<typeof NewTestInviteSchema>

export const TestInviteListFiltersSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  // Estado derivado: pendiente (no usado, no expirado), usado, expirado.
  state: z.enum(["PENDING", "IN_PROGRESS", "SUBMITTED", "REVIEWED", "EXPIRED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(15),
})

export type TestInviteListFilters = z.infer<typeof TestInviteListFiltersSchema>
