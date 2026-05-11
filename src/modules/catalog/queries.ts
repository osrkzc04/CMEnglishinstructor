import "server-only"
import { prisma } from "@/lib/prisma"

/**
 * Lecturas para el panel de catálogo (admin). A diferencia de
 * `enrollments/queries.ts:listProgramLevelOptions`, acá traemos también
 * niveles inactivos y contadores de uso, porque el admin necesita verlos
 * para decidir si reactivar o desactivar.
 */

export type ProgramLevelAdminRow = {
  id: string
  code: string
  name: string
  order: number
  cefrLevelCode: string | null
  totalHours: string
  hasPlatformAccess: boolean
  hasPdfMaterial: boolean
  isActive: boolean
  programId: string
  programName: string
  courseId: string
  courseName: string
  languageName: string
  enrollmentsCount: number
  classGroupsCount: number
}

export async function listProgramLevelsForAdmin(): Promise<
  ProgramLevelAdminRow[]
> {
  const rows = await prisma.programLevel.findMany({
    orderBy: [
      { program: { course: { name: "asc" } } },
      { program: { name: "asc" } },
      { order: "asc" },
    ],
    include: {
      program: { include: { course: { include: { language: true } } } },
      _count: { select: { enrollments: true, classGroups: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    order: r.order,
    cefrLevelCode: r.cefrLevelCode,
    totalHours: r.totalHours.toString(),
    hasPlatformAccess: r.hasPlatformAccess,
    hasPdfMaterial: r.hasPdfMaterial,
    isActive: r.isActive,
    programId: r.programId,
    programName: r.program.name,
    courseId: r.program.course.id,
    courseName: r.program.course.name,
    languageName: r.program.course.language.name,
    enrollmentsCount: r._count.enrollments,
    classGroupsCount: r._count.classGroups,
  }))
}

export type ProgramOption = {
  id: string
  name: string
  courseName: string
  languageName: string
}

/** Lista los programas para el dropdown del form "nuevo nivel". */
export async function listProgramOptions(): Promise<ProgramOption[]> {
  const rows = await prisma.program.findMany({
    where: { isActive: true },
    orderBy: [{ course: { name: "asc" } }, { name: "asc" }],
    include: { course: { include: { language: true } } },
  })
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    courseName: p.course.name,
    languageName: p.course.language.name,
  }))
}
