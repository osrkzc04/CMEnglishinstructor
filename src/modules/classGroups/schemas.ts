import { z } from "zod"
import { ClassGroupStatus, Modality } from "@prisma/client"

/**
 * Validaciones del módulo `classGroups` (aulas).
 *
 * Un aula concentra: el horario semanal (`slots`), el docente vigente y
 * las matrículas que están adentro. La duración por clase la decide el
 * `Course` correspondiente y se snapshotea al crear el aula.
 */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export const SlotInputSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(TIME_RE, "Hora inválida (HH:mm)"),
  /**
   * Largo de la clase en minutos. Ya no lo fija el nivel: el coordinador arma
   * runs de celdas de 15 min, así que la duración es múltiplo de 15. El nivel
   * solo aporta la duración "estándar" como referencia visual.
   */
  durationMinutes: z
    .number()
    .int()
    .min(15, "Mínimo 15 minutos")
    .refine((v) => v % 15 === 0, "Debe ser múltiplo de 15 minutos"),
})

export type SlotInput = z.infer<typeof SlotInputSchema>

// -----------------------------------------------------------------------------
//  Crear aula
// -----------------------------------------------------------------------------

// URL para reuniones — chequeo simple. No queremos exigir https:// estricto
// porque algunas plataformas usan esquemas custom (ej. zoommtg://). Solo
// validamos que sea una cadena con pinta de URL.
const MeetingUrlSchema = z
  .string()
  .trim()
  .max(500, "Máximo 500 caracteres")
  .refine((v) => v.length === 0 || /^[a-z][a-z0-9+.-]*:\/\//i.test(v), {
    message: "Tiene que ser una URL completa (https://…)",
  })
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))

const LocationSchema = z
  .string()
  .trim()
  .max(300, "Máximo 300 caracteres")
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))

export const NewClassGroupSchema = z
  .object({
    /**
     * Si se omite, la action lo autogenera desde el programLevel y los slots
     * (ej. "TZ2 · Mar-Jue 18h"). Editable más tarde.
     */
    name: z
      .string()
      .trim()
      .max(120, "Máximo 120 caracteres")
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    programLevelId: z.string().cuid("Nivel inválido"),
    modality: z.nativeEnum(Modality),
    slots: z.array(SlotInputSchema).min(1, "Agrega al menos un horario semanal"),
    /** Asignar docente al crear (opcional — coordinación puede dejarla sin docente). */
    teacherId: z.string().cuid("Docente inválido").optional(),
    /** Matrículas a sumar al aula al crear (opcional — pueden agregarse después). */
    enrollmentIds: z.array(z.string().cuid("Matrícula inválida")).default([]),
    notes: z
      .string()
      .trim()
      .max(2000, "Máximo 2000 caracteres")
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    /** Link de reunión recurrente — usado para VIRTUAL e HIBRIDO. */
    defaultMeetingUrl: MeetingUrlSchema,
    /** Ubicación recurrente — usada para PRESENCIAL e HIBRIDO. */
    defaultLocation: LocationSchema,
  })
  .superRefine((data, ctx) => {
    // Con largos variables, dos clases del mismo día no pueden solaparse.
    // Ordenamos por inicio y comprobamos que cada una empiece después del fin
    // de la anterior.
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number) as [number, number]
      return h * 60 + m
    }
    const byDay = new Map<number, { start: number; end: number }[]>()
    for (const s of data.slots) {
      const start = toMin(s.startTime)
      const list = byDay.get(s.dayOfWeek) ?? []
      list.push({ start, end: start + s.durationMinutes })
      byDay.set(s.dayOfWeek, list)
    }
    for (const list of byDay.values()) {
      list.sort((a, b) => a.start - b.start)
      for (let i = 1; i < list.length; i++) {
        if (list[i]!.start < list[i - 1]!.end) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["slots"],
            message: "Hay clases que se solapan en el mismo día",
          })
          return
        }
      }
    }
    // Link de Meet/Zoom: opcional al crear. El docente lo carga desde su
    // panel después de la asignación. La ubicación sí la pedimos para
    // presencial/híbrida porque no la conoce el docente sino la coordinación.
    if (
      (data.modality === Modality.PRESENCIAL || data.modality === Modality.HIBRIDO) &&
      !data.defaultLocation
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultLocation"],
        message: "Indicá la dirección o sede",
      })
    }
  })

export type NewClassGroupInput = z.infer<typeof NewClassGroupSchema>

// -----------------------------------------------------------------------------
//  Editar metadatos del aula (nombre + notas + meeting/location)
// -----------------------------------------------------------------------------

export const UpdateClassGroupSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
  notes: z
    .string()
    .trim()
    .max(2000, "Máximo 2000 caracteres")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  defaultMeetingUrl: MeetingUrlSchema,
  defaultLocation: LocationSchema,
})

export type UpdateClassGroupInput = z.infer<typeof UpdateClassGroupSchema>

// -----------------------------------------------------------------------------
//  Editar metadatos del aula desde el panel del DOCENTE
//
//  El docente solo puede tocar el nombre y el link de la reunión. Las notas
//  internas y la ubicación física las gestiona coordinación.
// -----------------------------------------------------------------------------

export const TeacherUpdateClassGroupSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
  defaultMeetingUrl: MeetingUrlSchema,
})

export type TeacherUpdateClassGroupInput = z.infer<typeof TeacherUpdateClassGroupSchema>

// -----------------------------------------------------------------------------
//  Cambiar estado (cerrar / cancelar)
// -----------------------------------------------------------------------------

export const SetClassGroupStatusSchema = z.object({
  status: z.enum([ClassGroupStatus.COMPLETED, ClassGroupStatus.CANCELLED]),
})

export type SetClassGroupStatusInput = z.infer<typeof SetClassGroupStatusSchema>

// -----------------------------------------------------------------------------
//  Filtros del listado
// -----------------------------------------------------------------------------

export const ClassGroupListFiltersSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  status: z.nativeEnum(ClassGroupStatus).optional(),
  programLevelId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(15),
})

export type ClassGroupListFilters = z.infer<typeof ClassGroupListFiltersSchema>
