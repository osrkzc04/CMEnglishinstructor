import { z } from "zod"
import { UserStatus } from "@prisma/client"

/**
 * Validación del docente para el panel admin. Ejes editables:
 *   - Datos personales (User)
 *   - Niveles CEFR
 *   - Disponibilidad semanal
 *
 * `hireDate` se setea automáticamente al alta. `bio` no se edita desde
 * admin. La tarifa por hora se gestiona a nivel administración (no por
 * docente) — el modelo Prisma mantiene `TeacherProfile.hourlyRate` para
 * compatibilidad, pero la fuente de verdad para el cálculo de payroll
 * vivirá en la futura pantalla de Configuración / Tarifario.
 */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

// -----------------------------------------------------------------------------
//  Datos personales
// -----------------------------------------------------------------------------

export const TeacherPersonalDataSchema = z.object({
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
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
})

export type TeacherPersonalDataInput = z.infer<typeof TeacherPersonalDataSchema>

// -----------------------------------------------------------------------------
//  Niveles CEFR que el docente puede dictar
// -----------------------------------------------------------------------------

export const TeacherLevelsSchema = z.object({
  levelIds: z
    .array(z.string().cuid("ID de nivel inválido"))
    .min(1, "Selecciona al menos un nivel"),
})

export type TeacherLevelsInput = z.infer<typeof TeacherLevelsSchema>

// -----------------------------------------------------------------------------
//  Disponibilidad semanal (bloques [start, end] por día)
// -----------------------------------------------------------------------------

export const AvailabilityBlockSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(TIME_RE, "Hora inválida (HH:mm)"),
    endTime: z.string().regex(TIME_RE, "Hora inválida (HH:mm)"),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: "La hora final debe ser posterior a la inicial",
    path: ["endTime"],
  })

export type AvailabilityBlock = z.infer<typeof AvailabilityBlockSchema>

export const TeacherAvailabilitySchema = z
  .object({
    blocks: z.array(AvailabilityBlockSchema),
  })
  .superRefine((data, ctx) => {
    const byDay = new Map<number, AvailabilityBlock[]>()
    for (const b of data.blocks) {
      const list = byDay.get(b.dayOfWeek) ?? []
      list.push(b)
      byDay.set(b.dayOfWeek, list)
    }
    for (const [, list] of byDay) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime))
      for (let i = 1; i < list.length; i++) {
        const curr = list[i]!
        const prev = list[i - 1]!
        if (curr.startTime < prev.endTime) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["blocks"],
            message: "Hay bloques que se superponen en el mismo día",
          })
          return
        }
      }
    }
  })

export type TeacherAvailabilityInput = z.infer<typeof TeacherAvailabilitySchema>

// -----------------------------------------------------------------------------
//  Schema combinado para alta (NewTeacher)
// -----------------------------------------------------------------------------

export const NewTeacherSchema = z
  .object({
    firstName: TeacherPersonalDataSchema.shape.firstName,
    lastName: TeacherPersonalDataSchema.shape.lastName,
    email: TeacherPersonalDataSchema.shape.email,
    phone: TeacherPersonalDataSchema.shape.phone,
    document: TeacherPersonalDataSchema.shape.document,
    status: TeacherPersonalDataSchema.shape.status,
    levelIds: TeacherLevelsSchema.shape.levelIds,
    blocks: z.array(AvailabilityBlockSchema),
  })
  .superRefine((data, ctx) => {
    const byDay = new Map<number, AvailabilityBlock[]>()
    for (const b of data.blocks) {
      const list = byDay.get(b.dayOfWeek) ?? []
      list.push(b)
      byDay.set(b.dayOfWeek, list)
    }
    for (const [, list] of byDay) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime))
      for (let i = 1; i < list.length; i++) {
        const curr = list[i]!
        const prev = list[i - 1]!
        if (curr.startTime < prev.endTime) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["blocks"],
            message: "Hay bloques que se superponen en el mismo día",
          })
          return
        }
      }
    }
  })

export type NewTeacherInput = z.infer<typeof NewTeacherSchema>

// -----------------------------------------------------------------------------
//  Filtros del listado
// -----------------------------------------------------------------------------

export const TeacherListFiltersSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  status: z.nativeEnum(UserStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(15),
})

export type TeacherListFilters = z.infer<typeof TeacherListFiltersSchema>
