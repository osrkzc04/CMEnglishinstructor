import "server-only"
import { ForbiddenError, requireAuth } from "@/modules/auth/guards"
import { prisma } from "@/lib/prisma"

/**
 * Verifica que el usuario actual pueda operar la sesión:
 *   - Director / Coordinador: siempre.
 *   - Docente: solo si es el asignado a la sesión.
 *   - Otros: forbidden.
 *
 * Devuelve el user de la sesión (con role resuelto desde DB) y el
 * `teacherId` de la clase para que el caller no la re-cargue.
 */
export async function requireSessionEditor(sessionId: string): Promise<{
  userId: string
  teacherId: string
  isAdmin: boolean
}> {
  const user = await requireAuth()

  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { teacherId: true },
  })
  if (!session) throw new ForbiddenError("Sesión no encontrada")

  const isAdmin = user.role === "DIRECTOR" || user.role === "COORDINATOR"
  const isAssignedTeacher =
    user.role === "TEACHER" && user.id === session.teacherId
  if (!isAdmin && !isAssignedTeacher) throw new ForbiddenError()

  return { userId: user.id, teacherId: session.teacherId, isAdmin }
}
