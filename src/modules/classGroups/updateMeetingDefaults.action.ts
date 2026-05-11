"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ClassGroupStatus, SessionStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireAuth } from "@/modules/auth/guards"

/**
 * Edita los defaults de reunión del aula (link y/o ubicación). Se la usa
 * tanto desde el panel admin como desde el docente — el docente la invoca
 * cuando carga el link de Meet/Zoom para sus clases.
 *
 * Comportamiento:
 *   1. Update del aula (`defaultMeetingUrl`, `defaultLocation`).
 *   2. Propaga a todas las sesiones del aula con `status=SCHEDULED`.
 *      Sesiones COMPLETED o CANCELLED quedan con su snapshot histórico.
 *
 * Autorización: el docente asignado vigente del aula, o un admin
 * (DIRECTOR / COORDINATOR). El docente puede usar la action solo sobre las
 * aulas donde tiene `TeacherAssignment` con `endDate=null`.
 */

// URL más permisiva que la del NewClassGroup — acá se llama puntualmente
// del docente que carga el link, así que solo chequeamos formato general.
const InputSchema = z.object({
  classGroupId: z.string().cuid("Aula inválida"),
  meetingUrl: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .superRefine((v, ctx) => {
      if (v === null) return
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Tiene que ser una URL completa (https://…)",
        })
      }
    }),
  location: z
    .string()
    .trim()
    .max(300, "Máximo 300 caracteres")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
})

export type UpdateMeetingDefaultsInput = z.input<typeof InputSchema>

type Result =
  | {
      success: true
      sessionsUpdated: number
    }
  | { success: false; error: string }

export async function updateClassGroupMeetingDefaults(
  input: UpdateMeetingDefaultsInput,
): Promise<Result> {
  const user = await requireAuth()

  const parsed = InputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const data = parsed.data

  const group = await prisma.classGroup.findUnique({
    where: { id: data.classGroupId },
    select: {
      id: true,
      status: true,
      teacherAssignments: {
        where: { endDate: null },
        select: { teacherId: true },
        take: 1,
      },
    },
  })
  if (!group) return { success: false, error: "Aula no encontrada" }
  if (group.status !== ClassGroupStatus.ACTIVE) {
    return { success: false, error: "El aula no está activa" }
  }

  const isAdmin = user.role === "DIRECTOR" || user.role === "COORDINATOR"
  const isAssignedTeacher =
    user.role === "TEACHER" &&
    group.teacherAssignments[0]?.teacherId === user.id
  if (!isAdmin && !isAssignedTeacher) throw new ForbiddenError()

  const result = await prisma.$transaction(async (tx) => {
    await tx.classGroup.update({
      where: { id: data.classGroupId },
      data: {
        defaultMeetingUrl: data.meetingUrl,
        defaultLocation: data.location,
      },
    })

    // Propagar a sesiones SCHEDULED. No tocamos COMPLETED/CANCELLED para
    // preservar histórico.
    const updated = await tx.classSession.updateMany({
      where: {
        classGroupId: data.classGroupId,
        status: SessionStatus.SCHEDULED,
      },
      data: {
        meetingUrl: data.meetingUrl,
        location: data.location,
      },
    })

    return updated.count
  })

  revalidatePath(`/admin/aulas/${data.classGroupId}`)
  revalidatePath(`/docente/clases`)
  return { success: true, sessionsUpdated: result }
}
