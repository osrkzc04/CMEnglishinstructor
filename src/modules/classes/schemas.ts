import { z } from "zod"
import { AttendanceStatus } from "@prisma/client"

/**
 * Validaciones del módulo `classes` (sesiones de clase materializadas).
 *
 * Cubre asistencia, bitácora y cancelación. El cierre lo dispara una action
 * sin más payload que el `sessionId` — el resultado se calcula desde lo ya
 * persistido (asistencia + log).
 */

// -----------------------------------------------------------------------------
//  Asistencia (auto-save por participante)
// -----------------------------------------------------------------------------

export const AttendanceUpdateSchema = z.object({
  participantId: z.string().cuid("Participante inválido"),
  status: z.nativeEnum(AttendanceStatus),
  notes: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
})

export const UpdateAttendanceSchema = z.object({
  sessionId: z.string().cuid("Sesión inválida"),
  updates: z.array(AttendanceUpdateSchema).min(1, "Sin cambios"),
})
export type UpdateAttendanceInput = z.infer<typeof UpdateAttendanceSchema>

// -----------------------------------------------------------------------------
//  Bitácora (upsert)
// -----------------------------------------------------------------------------

export const ClassLogSchema = z.object({
  sessionId: z.string().cuid("Sesión inválida"),
  topic: z
    .string()
    .trim()
    .min(2, "Tema requerido")
    .max(200, "Máximo 200 caracteres"),
  activities: z
    .string()
    .trim()
    .min(2, "Describí qué se hizo en clase")
    .max(4000, "Máximo 4000 caracteres"),
  homework: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  materialsUsed: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
})
export type ClassLogInput = z.infer<typeof ClassLogSchema>

// -----------------------------------------------------------------------------
//  Cancelación
// -----------------------------------------------------------------------------

export const CancelClassSessionSchema = z.object({
  sessionId: z.string().cuid("Sesión inválida"),
  reason: z
    .string()
    .trim()
    .min(2, "Indicá el motivo")
    .max(500, "Máximo 500 caracteres"),
})
export type CancelClassSessionInput = z.infer<typeof CancelClassSessionSchema>

// -----------------------------------------------------------------------------
//  Cierre
// -----------------------------------------------------------------------------

export const CloseClassSessionSchema = z.object({
  sessionId: z.string().cuid("Sesión inválida"),
})
export type CloseClassSessionInput = z.infer<typeof CloseClassSessionSchema>
