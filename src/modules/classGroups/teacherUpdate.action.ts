"use server"

import { revalidatePath } from "next/cache"
import { ClassGroupStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireAuth } from "@/modules/auth/guards"
import {
  TeacherUpdateClassGroupSchema,
  type TeacherUpdateClassGroupInput,
} from "./schemas"

type Result =
  | { success: true }
  | {
      success: false
      error: string
      field?: keyof TeacherUpdateClassGroupInput
    }

/**
 * Edita el aula desde el panel del docente. Sólo cambia `name` y
 * `defaultMeetingUrl` — `notes`, `defaultLocation` y todo lo estructural
 * (slots, modalidad, programa) son del dominio de coordinación.
 *
 * Autorización: el caller tiene que ser TEACHER y ser el docente vigente de
 * la aula (`TeacherAssignment` con `endDate = null`). Si dejó de serlo en
 * el medio del request, devolvemos el mismo error que si nunca lo fue —
 * evitamos exfiltrar el id.
 */
export async function teacherUpdateClassGroup(
  classGroupId: string,
  input: TeacherUpdateClassGroupInput,
): Promise<Result> {
  const user = await requireAuth()
  if (user.role !== "TEACHER") throw new ForbiddenError()

  const parsed = TeacherUpdateClassGroupSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as
      | keyof TeacherUpdateClassGroupInput
      | undefined
    return { success: false, error: issue?.message ?? "Datos inválidos", field }
  }
  const data = parsed.data

  const group = await prisma.classGroup.findFirst({
    where: {
      id: classGroupId,
      status: ClassGroupStatus.ACTIVE,
      teacherAssignments: { some: { teacherId: user.id, endDate: null } },
    },
    select: { id: true },
  })
  if (!group) {
    return { success: false, error: "No tienes acceso a esta aula" }
  }

  await prisma.classGroup.update({
    where: { id: classGroupId },
    data: {
      name: data.name,
      defaultMeetingUrl: data.defaultMeetingUrl ?? null,
    },
  })

  revalidatePath(`/docente/aulas/${classGroupId}`)
  revalidatePath("/docente/aulas")
  revalidatePath("/docente/dashboard")
  return { success: true }
}
