import { z } from "zod"
import { UserStatus } from "@prisma/client"

/**
 * Validación del módulo de usuarios staff (DIRECTOR / COORDINATOR).
 *
 * Este módulo gestiona usuarios internos — no estudiantes ni docentes. Los
 * roles permitidos están explícitamente acotados a DIRECTOR y COORDINATOR;
 * crear un STUDENT o TEACHER desde acá rompería la integridad del modelo
 * (ambos requieren su `studentProfile` / `teacherProfile` y flujos propios).
 */

export const StaffRoleSchema = z.enum(["DIRECTOR", "COORDINATOR"], {
  errorMap: () => ({ message: "Selecciona el rol del usuario" }),
})

export type StaffRole = z.infer<typeof StaffRoleSchema>

const baseShape = {
  firstName: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  lastName: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  phone: z
    .string()
    .trim()
    .max(20, "Teléfono inválido")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  document: z
    .string()
    .trim()
    .max(20, "Documento inválido")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  role: StaffRoleSchema,
}

// -----------------------------------------------------------------------------
//  Alta
// -----------------------------------------------------------------------------

export const NewStaffSchema = z.object({
  ...baseShape,
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
})

export type NewStaffInput = z.infer<typeof NewStaffSchema>

// -----------------------------------------------------------------------------
//  Edición
// -----------------------------------------------------------------------------

export const StaffFormSchema = z.object({
  ...baseShape,
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
})

export type StaffFormInput = z.infer<typeof StaffFormSchema>

// -----------------------------------------------------------------------------
//  Filtros del listado
// -----------------------------------------------------------------------------

export const StaffListFiltersSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  status: z.nativeEnum(UserStatus).optional(),
  role: StaffRoleSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(15),
})

export type StaffListFilters = z.infer<typeof StaffListFiltersSchema>
