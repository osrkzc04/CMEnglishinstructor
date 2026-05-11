import "server-only"
import { Role, EnrollmentStatus, ClassGroupStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Determina si un usuario puede consumir materiales de un `ProgramLevel`.
 *
 *   - DIRECTOR / COORDINATOR: acceso total.
 *   - TEACHER: niveles donde tiene un `TeacherAssignment` vigente vinculado
 *     a un `ClassGroup` activo de ese nivel. (Cuando termina un aula
 *     pierde acceso a sus materiales — alineado con la idea de "veo lo que
 *     enseño hoy".)
 *   - STUDENT: niveles donde tiene un `Enrollment` ACTIVE.
 */
export async function canAccessProgramLevel(
  userId: string,
  role: Role,
  programLevelId: string,
): Promise<boolean> {
  if (role === Role.DIRECTOR || role === Role.COORDINATOR) return true

  if (role === Role.TEACHER) {
    const hit = await prisma.teacherAssignment.findFirst({
      where: {
        teacherId: userId,
        endDate: null,
        classGroup: {
          status: ClassGroupStatus.ACTIVE,
          programLevelId,
        },
      },
      select: { id: true },
    })
    return Boolean(hit)
  }

  if (role === Role.STUDENT) {
    const hit = await prisma.enrollment.findFirst({
      where: {
        studentId: userId,
        status: EnrollmentStatus.ACTIVE,
        programLevelId,
      },
      select: { id: true },
    })
    return Boolean(hit)
  }

  return false
}

/**
 * Devuelve los `programLevelIds` accesibles. Útil para listar las raíces
 * que ve cada rol en su pantalla de materiales.
 */
export async function listAccessibleProgramLevels(
  userId: string,
  role: Role,
): Promise<string[]> {
  if (role === Role.DIRECTOR || role === Role.COORDINATOR) {
    const all = await prisma.programLevel.findMany({ select: { id: true } })
    return all.map((l) => l.id)
  }

  if (role === Role.TEACHER) {
    const rows = await prisma.teacherAssignment.findMany({
      where: {
        teacherId: userId,
        endDate: null,
        classGroup: { status: ClassGroupStatus.ACTIVE },
      },
      select: { classGroup: { select: { programLevelId: true } } },
    })
    return Array.from(new Set(rows.map((r) => r.classGroup.programLevelId)))
  }

  if (role === Role.STUDENT) {
    const rows = await prisma.enrollment.findMany({
      where: { studentId: userId, status: EnrollmentStatus.ACTIVE },
      select: { programLevelId: true },
    })
    return Array.from(new Set(rows.map((r) => r.programLevelId)))
  }

  return []
}
