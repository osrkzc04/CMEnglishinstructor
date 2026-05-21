import "server-only"
import { createHash, randomBytes } from "node:crypto"

/**
 * Device lock para `TestSession`.
 *
 * Modelo: al primer POST /start el servidor:
 *  1. Genera un secreto aleatorio (32 bytes hex) y lo escribe en una cookie
 *     httpOnly con SameSite=Lax, max-age = duración del examen.
 *  2. Guarda en DB `TestSession.deviceCookieHash = sha256(secret)` y
 *     `TestSession.deviceFingerprint = sha256(userAgent + "|" + ipSubnet)`.
 *
 * En requests subsiguientes:
 *  - Si la cookie no llega o su hash no matchea → "evaluación iniciada en
 *    otro dispositivo".
 *  - Si el fingerprint cambia (cambió la red o el navegador) → mismo error.
 *
 * El fingerprint usa `ipSubnet` (primeros 3 octetos en IPv4, /48 en IPv6) en
 * vez de la IP completa para tolerar cambios de IP por NAT / WiFi público
 * sin perder defensa razonable. La cookie + UA bastan para detectar otro
 * dispositivo aunque la IP varíe.
 *
 * Stub de Fase 1. Implementación real en Fase 3.
 */

const COOKIE_NAME = "tsd" // test session device

export function generateDeviceSecret(): string {
  return randomBytes(32).toString("hex")
}

export function hashDeviceSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

/**
 * Fingerprint estable del par UA + subred de la IP. Recibe los headers/IP
 * desde el route handler (no toca cookies — eso va aparte).
 */
export function fingerprint(userAgent: string | null, ip: string | null): string {
  const uaPart = (userAgent ?? "").trim().slice(0, 512)
  const ipPart = ip ? subnetOf(ip) : ""
  return createHash("sha256").update(`${uaPart}|${ipPart}`).digest("hex")
}

function subnetOf(ip: string): string {
  // IPv4 → primeros 3 octetos. IPv6 → primeros 48 bits (3 grupos de 16).
  if (ip.includes(".")) {
    const parts = ip.split(".")
    return parts.slice(0, 3).join(".")
  }
  if (ip.includes(":")) {
    const parts = ip.split(":")
    return parts.slice(0, 3).join(":")
  }
  return ip
}

export const DEVICE_COOKIE = {
  name: COOKIE_NAME,
  // Opciones para cookies().set — Server Components / Route Handlers.
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
}

// -----------------------------------------------------------------------------
//  Validación de acceso a una sesión activa
// -----------------------------------------------------------------------------

export type DeviceCheckInput = {
  cookieHashOnSession: string | null
  fingerprintOnSession: string | null
  cookieValueFromRequest: string | null
  userAgentFromRequest: string | null
  ipFromRequest: string | null
}

export type DeviceCheckResult =
  | { ok: true }
  | { ok: false; reason: "missing_cookie" | "cookie_mismatch" | "fingerprint_mismatch" }

/**
 * Verifica que el cliente que envía el request sea el mismo dispositivo donde
 * la sesión se inició. Si falla, el caller debe devolver HTTP 423 y NO marcar
 * TIMED_OUT — esto NO consume el examen, solo lo bloquea al request inválido.
 */
export function checkDeviceAccess(input: DeviceCheckInput): DeviceCheckResult {
  if (!input.cookieValueFromRequest) return { ok: false, reason: "missing_cookie" }
  if (!input.cookieHashOnSession) return { ok: false, reason: "missing_cookie" }
  const expectedHash = hashDeviceSecret(input.cookieValueFromRequest)
  if (expectedHash !== input.cookieHashOnSession) {
    return { ok: false, reason: "cookie_mismatch" }
  }
  if (input.fingerprintOnSession) {
    const fp = fingerprint(input.userAgentFromRequest, input.ipFromRequest)
    if (fp !== input.fingerprintOnSession) {
      return { ok: false, reason: "fingerprint_mismatch" }
    }
  }
  return { ok: true }
}
