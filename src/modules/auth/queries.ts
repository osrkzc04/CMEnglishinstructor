import "server-only"
import { cache } from "react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Devuelve el usuario de la sesión actual o `null`. Uso: Server Components
 * que necesitan saber si hay sesión sin forzar redirect (para eso ver
 * `guards.ts`).
 *
 * Re-valida `User.status` contra DB porque las sesiones son JWT y pueden
 * estar desfasadas con la realidad (usuario desactivado, eliminado, o DB
 * reseteada después de emitir el token). Sin esta validación, el `/login`
 * que llama acá redirigía al dashboard, y el dashboard rebota a `/login`
 * → ERR_TOO_MANY_REDIRECTS.
 */
export const getSessionUser = cache(async () => {
  const session = await auth()
  if (!session?.user?.id) return null

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, role: true },
  })
  if (!dbUser || dbUser.status !== "ACTIVE") return null

  return { ...session.user, role: dbUser.role }
})
