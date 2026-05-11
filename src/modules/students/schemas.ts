import { z } from "zod"
import { Modality, UserStatus } from "@prisma/client"

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Validación del estudiante para el panel admin.
 *
 * Cubre alta + edición desde un mismo formulario. Combina datos del User
 * (firstName, lastName, email, document, phone, status) con los del
 * StudentProfile (company, position, notes).
 *
 * El horario semanal de clase NO vive acá — vive en `ClassGroup` (aula) a
 * través del `Enrollment.classGroupId`. El estudiante puede tener múltiples
 * matrículas (cada una con su propia aula y horario). Lo que sí vive en
 * este módulo es el `StudentPreferredSchedule` — la disponibilidad
 * declarada del alumno, que se usa para encontrar aula compatible.
 */

export const StudentFormSchema = z.object({
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
  company: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  position: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  notes: z
    .string()
    .trim()
    .max(2000, "Máximo 2000 caracteres")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
})

export type StudentFormInput = z.infer<typeof StudentFormSchema>

// -----------------------------------------------------------------------------
//  Horario semanal preferido (StudentPreferredSchedule)
// -----------------------------------------------------------------------------
//
// Mismo formato y reglas que `TeacherAvailability`: bloques [start, end]
// recurrentes por día en hora local de Guayaquil. Reemplazo total al
// guardar (delete + insert), mismo patrón que el docente.
//
// Definido antes que `NewStudentWithEnrollmentSchema` porque éste lo
// referencia para incluir el horario en el alta.

export const StudentScheduleBlockSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(TIME_RE, "Hora inválida (HH:mm)"),
    endTime: z.string().regex(TIME_RE, "Hora inválida (HH:mm)"),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: "La hora final debe ser posterior a la inicial",
    path: ["endTime"],
  })

export type StudentScheduleBlock = z.infer<typeof StudentScheduleBlockSchema>

export const StudentScheduleSchema = z
  .object({
    blocks: z.array(StudentScheduleBlockSchema),
  })
  .superRefine((data, ctx) => {
    const byDay = new Map<number, StudentScheduleBlock[]>()
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

export type StudentScheduleInput = z.infer<typeof StudentScheduleSchema>

// -----------------------------------------------------------------------------
//  Alta de estudiante con matrícula
// -----------------------------------------------------------------------------
//
// La matrícula al alta es ligera: programa + modalidad + horario preferido.
// La asignación de aula se hace por separado desde el menú de Aulas, no en
// este formulario — al alta el alumno siempre queda "en espera de aula".
// El horario preferido alimenta el algoritmo de cruce de disponibilidad
// que el coordinador usa al armar el aula.

export const NewStudentWithEnrollmentSchema = z.object({
  // Datos personales
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

  // Datos profesionales (opcionales)
  company: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  position: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  studentNotes: z
    .string()
    .trim()
    .max(2000, "Máximo 2000 caracteres")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),

  // Matrícula
  programLevelId: z.string().cuid("Nivel inválido"),
  modality: z.nativeEnum(Modality, {
    errorMap: () => ({ message: "Selecciona la modalidad" }),
  }),
  enrollmentNotes: z
    .string()
    .trim()
    .max(2000, "Máximo 2000 caracteres")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),

  // Horario preferido (opcional al alta — se puede cargar después desde el
  // detalle del estudiante). Vacío = "estoy abierto a cualquier horario".
  preferredSchedule: z.array(StudentScheduleBlockSchema).default([]),
})

export type NewStudentWithEnrollmentInput = z.infer<
  typeof NewStudentWithEnrollmentSchema
>

// -----------------------------------------------------------------------------
//  Filtros del listado
// -----------------------------------------------------------------------------

export const StudentListFiltersSchema = z.object({
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

export type StudentListFilters = z.infer<typeof StudentListFiltersSchema>
