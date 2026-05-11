import "server-only"

/**
 * Verifica un token de Cloudflare Turnstile contra el endpoint oficial.
 *
 * Si `TURNSTILE_SECRET_KEY` no está configurado (entornos de dev sin
 * captcha) la verificación se omite y devuelve `true`. En producción la
 * variable es obligatoria y la action que lo invoca debe abortar si falta.
 *
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing_token" | "invalid_token" | "network_error" }

export async function verifyTurnstile(
  token: string | undefined,
  ip?: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return { ok: true }

  if (!token) return { ok: false, reason: "missing_token" }

  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set("remoteip", ip)

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      // Cloudflare puede tardar; cap a 5s para no colgar la action.
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { ok: false, reason: "network_error" }
    const data = (await res.json()) as { success: boolean }
    return data.success ? { ok: true } : { ok: false, reason: "invalid_token" }
  } catch {
    return { ok: false, reason: "network_error" }
  }
}
