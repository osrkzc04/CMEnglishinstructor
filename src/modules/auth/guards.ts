import "server-only"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { Role } from "@prisma/client"

/**
 * Helpers de autorización para usar en Server Components, Server Actions y
 * Route Handlers. Centralizan la lógica de "quién puede hacer qué" para que
 * NUNCA aparezca `if (session.user.role !== 'X')` inline en el código.
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

/**
 * Asegura que hay sesión y devuelve el usuario.
 * Si no hay sesión, redirige a /login (en RSC) o lanza UnauthorizedError.
 */
export async function requireAuth(opts?: { redirectTo?: string }) {
  const session = await auth()
  if (!session?.user) {
    if (opts?.redirectTo === "throw") throw new UnauthorizedError()
    redirect("/login")
  }
  return session.user
}

/**
 * Asegura que el usuario autenticado tiene uno de los roles permitidos.
 * Si no, lanza ForbiddenError.
 */
export async function requireRole(allowed: Role[]) {
  const user = await requireAuth()
  // @ts-expect-error — sesión extendida con role
  if (!user.role || !allowed.includes(user.role)) {
    throw new ForbiddenError()
  }
  return user
}

/**
 * Asegura que el usuario es propietario del recurso (ej: estudiante de una
 * matrícula, docente de una sesión). Director y coordinador siempre pasan.
 */
export async function requireOwnership(opts: {
  ownerId: string
  bypassRoles?: Role[]
}) {
  const user = await requireAuth()
  const bypass = opts.bypassRoles ?? (["DIRECTOR", "COORDINATOR"] as Role[])
  // @ts-expect-error — sesión extendida con role
  if (bypass.includes(user.role)) return user
  if (user.id === opts.ownerId) return user
  throw new ForbiddenError("No eres propietario de este recurso")
}
