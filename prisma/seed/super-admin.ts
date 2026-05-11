import { PrismaClient, Role } from "@prisma/client"
import { hash } from "bcryptjs"

export type SuperAdminSeed = {
  email: string
  password: string
  firstName: string
  lastName: string
  document?: string | null
  phone?: string | null
}

/**
 * Crea o asegura la existencia del super administrador (DIRECTOR).
 *
 * `update: {}` deja inmutable la contraseña / datos en runs posteriores —
 * cambiar la pass se hace desde la UI o re-bootstrap manual con la query
 * adecuada.
 *
 * Devuelve el `id` del director — útil para enlazarlo como `updatedBy` /
 * `createdBy` en otros seeds (settings, holidays).
 */
export async function seedSuperAdmin(prisma: PrismaClient, data: SuperAdminSeed): Promise<string> {
  const passwordHash = await hash(data.password, 10)
  const user = await prisma.user.upsert({
    where: { email: data.email },
    update: {},
    create: {
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: Role.DIRECTOR,
      document: data.document ?? null,
      phone: data.phone ?? null,
    },
  })
  return user.id
}

/**
 * Lee credenciales del super admin desde variables de entorno.
 *
 * Requiere `SUPER_ADMIN_EMAIL` y `SUPER_ADMIN_PASSWORD`. Si falta alguna,
 * lanza error con mensaje claro — el deploy queda explícitamente bloqueado
 * hasta que se configuren, en lugar de fallar silenciosamente sin admin.
 */
export function readSuperAdminFromEnv(): SuperAdminSeed {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim()
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim()
  if (!email || !password) {
    throw new Error(
      "Faltan SUPER_ADMIN_EMAIL y/o SUPER_ADMIN_PASSWORD. Definilos en el entorno antes de correr el seed de producción.",
    )
  }
  return {
    email,
    password,
    firstName: process.env.SUPER_ADMIN_FIRST_NAME?.trim() || "Director",
    lastName: process.env.SUPER_ADMIN_LAST_NAME?.trim() || "Principal",
    document: process.env.SUPER_ADMIN_DOCUMENT?.trim() || null,
    phone: process.env.SUPER_ADMIN_PHONE?.trim() || null,
  }
}
