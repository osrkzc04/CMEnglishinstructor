"use server"

import { requireRole } from "@/modules/auth/guards"
import { prisma } from "@/lib/prisma"
import {
  listEligibleStudentsForLevel,
  listEligibleTeachersForLevel,
  type EligibleStudentCandidate,
  type EligibleTeacherCandidate,
} from "./queries"

export type LoadCandidatesResult =
  | {
      success: true
      durationMinutes: number
      cefrLevelCode: string | null
      students: EligibleStudentCandidate[]
      teachers: EligibleTeacherCandidate[]
    }
  | { success: false; error: string }

/**
 * Cargada por el form de "Nueva aula" cuando el coordinador selecciona un
 * nivel — devuelve docentes elegibles, estudiantes elegibles y la duración
 * de la clase para alimentar el heatmap.
 */
export async function loadAulaCandidates(
  programLevelId: string,
): Promise<LoadCandidatesResult> {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const level = await prisma.programLevel.findUnique({
    where: { id: programLevelId },
    select: {
      cefrLevelCode: true,
      program: { select: { course: { select: { classDuration: true } } } },
    },
  })
  if (!level) return { success: false, error: "Nivel no encontrado" }

  const [students, teachers] = await Promise.all([
    listEligibleStudentsForLevel(programLevelId),
    listEligibleTeachersForLevel(programLevelId),
  ])

  return {
    success: true,
    durationMinutes: level.program.course.classDuration,
    cefrLevelCode: level.cefrLevelCode,
    students,
    teachers,
  }
}
