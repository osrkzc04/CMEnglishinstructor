import "server-only"
import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/prisma"

/**
 * Helpers para los tokens de activación de cuenta y de recuperación de
 * contraseña. Reusamos el modelo `VerificationToken` (estándar Auth.js)
 * codificando el propósito en `identifier` con el formato
 * `"<purpose>:<userId>"`.
 *
 * Ambos tokens son de un solo uso: al consumirlos, se borra la fila para
 * evitar reuso.
 */

export type TokenPurpose = "activation" | "reset"

const TTL_MINUTES: Record<TokenPurpose, number> = {
  activation: 60 * 24 * 7, // 7 días
  reset: 60, // 1 hora
}

const RATE_LIMIT_PER_HOUR = 5

function makeIdentifier(purpose: TokenPurpose, userId: string): string {
  return `${purpose}:${userId}`
}

function parseIdentifier(
  identifier: string,
): { purpose: TokenPurpose; userId: string } | null {
  const idx = identifier.indexOf(":")
  if (idx <= 0) return null
  const purpose = identifier.slice(0, idx)
  const userId = identifier.slice(idx + 1)
  if (purpose !== "activation" && purpose !== "reset") return null
  if (!userId) return null
  return { purpose, userId }
}

function generateToken(): string {
  return randomBytes(32).toString("hex")
}

export type CreatedToken = {
  token: string
  expiresAt: Date
}

/**
 * Genera un token nuevo. Si ya existían tokens vigentes para el mismo
 * usuario+propósito, los revoca (un solo enlace activo a la vez para
 * activación; para reset puede haber múltiples si se reenvía).
 */
export async function createUserToken(
  userId: string,
  purpose: TokenPurpose,
  opts: { rateLimit?: boolean } = {},
): Promise<CreatedToken | { rateLimited: true }> {
  if (opts.rateLimit) {
    const since = new Date(Date.now() - 60 * 60 * 1000)
    const recent = await prisma.verificationToken.count({
      where: {
        identifier: makeIdentifier(purpose, userId),
        expires: { gte: since },
      },
    })
    if (recent >= RATE_LIMIT_PER_HOUR) {
      return { rateLimited: true }
    }
  }

  // Para activación dejamos siempre solo un token vivo. Para reset también
  // limpiamos los anteriores cuando admin / usuario regenera.
  await prisma.verificationToken.deleteMany({
    where: { identifier: makeIdentifier(purpose, userId) },
  })

  const token = generateToken()
  const expiresAt = new Date(Date.now() + TTL_MINUTES[purpose] * 60 * 1000)

  await prisma.verificationToken.create({
    data: {
      identifier: makeIdentifier(purpose, userId),
      token,
      expires: expiresAt,
    },
  })

  return { token, expiresAt }
}

export type ConsumedToken = {
  userId: string
  purpose: TokenPurpose
}

/**
 * Consume un token: lo verifica, valida expiración y lo elimina. Devuelve
 * `null` si el token es inválido o expiró — ambos errores se devuelven
 * iguales para no filtrar si el token existió.
 */
export async function consumeUserToken(
  token: string,
): Promise<ConsumedToken | null> {
  const row = await prisma.verificationToken.findUnique({ where: { token } })
  if (!row) return null

  const parsed = parseIdentifier(row.identifier)
  if (!parsed) {
    await prisma.verificationToken.delete({ where: { token } }).catch(() => {})
    return null
  }

  if (row.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } }).catch(() => {})
    return null
  }

  await prisma.verificationToken.delete({ where: { token } })
  return parsed
}

/**
 * Inspecciona un token sin consumirlo. Útil para validar antes de mostrar
 * el form de "setear contraseña" (no queremos quemar el token solo por
 * abrir la página).
 */
export async function peekUserToken(
  token: string,
): Promise<ConsumedToken | null> {
  const row = await prisma.verificationToken.findUnique({ where: { token } })
  if (!row) return null
  if (row.expires < new Date()) return null
  return parseIdentifier(row.identifier)
}

/**
 * Borra todos los tokens vivos de un usuario para un propósito. Útil cuando
 * el admin desactiva al usuario (los enlaces emitidos quedan inválidos).
 */
export async function revokeUserTokens(
  userId: string,
  purpose?: TokenPurpose,
): Promise<number> {
  const where = purpose
    ? { identifier: makeIdentifier(purpose, userId) }
    : {
        identifier: {
          in: [
            makeIdentifier("activation", userId),
            makeIdentifier("reset", userId),
          ],
        },
      }
  const result = await prisma.verificationToken.deleteMany({ where })
  return result.count
}
