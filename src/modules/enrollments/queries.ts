import "server-only"
import { cache } from "react"
import { prisma } from "@/lib/prisma"

/**
 * Lecturas auxiliares del módulo enrollments. La matrícula es ligera:
 *  - referencia un `ProgramLevel`
 *  - opcionalmente apunta a un `ClassGroup` (aula) que define horario y
 *    docente
 *
 * Las queries de detalle de estudiante con sus matrículas viven en
 * `modules/students/queries.ts`. Acá quedan solo los lookups que precargan
 * forms (catálogo de niveles, docentes activos para la elegibilidad de
 * aula).
 */

// -----------------------------------------------------------------------------
//  Catálogo: ProgramLevel con su jerarquía Curso → Programa
// -----------------------------------------------------------------------------

export type ProgramLevelOption = {
  id: string
  code: string
  name: string
  cefrLevelCode: string | null
  classDurationMinutes: number
  languageId: string
  languageName: string
  courseId: string
  courseName: string
  programId: string
  programName: string
}

export const listProgramLevelOptions = cache(async (): Promise<ProgramLevelOption[]> => {
  const rows = await prisma.programLevel.findMany({
    // Pickers solo ven niveles activos. Para el panel admin usar
    // `listAllProgramLevels` que ignora el filtro.
    where: { isActive: true },
    orderBy: [{ programId: "asc" }, { order: "asc" }],
    include: {
      program: {
        include: {
          course: { include: { language: true } },
        },
      },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    cefrLevelCode: r.cefrLevelCode ?? null,
    classDurationMinutes: r.program.course.classDuration,
    languageId: r.program.course.language.id,
    languageName: r.program.course.language.name,
    courseId: r.program.course.id,
    courseName: r.program.course.name,
    programId: r.program.id,
    programName: r.program.name,
  }))
})
