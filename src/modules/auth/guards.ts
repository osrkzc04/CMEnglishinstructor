import "server-only"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Helpers de autorización para Server Components, Server Actions y Route
 * Handlers. Centralizan la lógica de "quién puede hacer qué" para que nunca
 * aparezca `if (session.user.role !== 'X')` inline.
 *
 * Nota sobre JWT: `requireAuth` re-valida `User.status` contra DB en cada
 * llamada porque las sesiones son JWT (stateless) — sin esto, un usuario
 * desactivado seguiría navegando hasta que su token expire.
 */

export class UnauthorizedError extends Error {
  constructor() {
    super("No autenticado")
    this.name = "UnauthorizedError"
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Sin permisos para esta acción") {
    super(message)
    this.name = "ForbiddenError"
  }
}

export async function requireAuth(opts?: { redirectTo?: "throw" }) {
  const session = await auth()
  if (!session?.user?.id) {
    if (opts?.redirectTo === "throw") throw new UnauthorizedError()
    redirect("/login")
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, role: true },
  })

  if (!dbUser || dbUser.status !== "ACTIVE") {
    if (opts?.redirectTo === "throw") throw new UnauthorizedError()
    redirect("/login?reason=inactive")
  }

  // El rol en DB es la fuente de verdad — el JWT puede estar desfasado si
  // alguna vez se permite cambiar rol post-emisión.
  return { ...session.user, role: dbUser.role } as typeof session.user
}

export async function requireRole(allowed: Role[]) {
  const user = await requireAuth()
  if (!user.role || !allowed.includes(user.role)) {
    throw new ForbiddenError()
  }
  return user
}

export async function requireOwnership(opts: {
  ownerId: string
  bypassRoles?: Role[]
}) {
  const user = await requireAuth()
  const bypass = opts.bypassRoles ?? (["DIRECTOR", "COORDINATOR"] as Role[])
  if (user.role && bypass.includes(user.role)) return user
  if (user.id === opts.ownerId) return user
  throw new ForbiddenError("No eres propietario de este recurso")
}
