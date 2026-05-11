import "server-only"

/**
 * Rate-limiter en memoria, lookup por clave + ventana deslizante simple.
 *
 * Sirve para forms públicos donde una sola instancia Node es suficiente
 * (hosting tipo cPanel / Plesk / VPS chico). Si más adelante se escala a
 * varias instancias, migrar a Redis o a una tabla en Postgres con TTL —
 * la API de `checkLimit` se mantiene.
 *
 * Cada bucket es independiente (ej. "ip:1.2.3.4" y "email:foo@bar.com"
 * comparten el mismo Map pero no se mezclan). El consumidor decide qué
 * combinaciones quiere chequear.
 */

type Entry = { count: number; resetAt: number }

const buckets = new Map<string, Entry>()

export type RateLimitOptions = {
  /** Identificador único del bucket (ej. `ip:1.2.3.4`, `email:foo@bar.com`). */
  key: string
  /** Cuántos hits se permiten dentro de la ventana. */
  limit: number
  /** Ventana en milisegundos. */
  windowMs: number
}

export type RateLimitResult = { ok: true; remaining: number } | { ok: false; retryAfterSec: number }

/**
 * Registra un hit y devuelve si el caller puede proceder. La operación es
 * O(1); el Map crece con el tráfico pero las entradas se reciclan en
 * cuanto la próxima consulta toca una clave expirada.
 */
export function checkLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(opts.key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(opts.key, { count: 1, resetAt: now + opts.windowMs })
    return { ok: true, remaining: opts.limit - 1 }
  }

  if (existing.count >= opts.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  return { ok: true, remaining: opts.limit - existing.count }
}

/**
 * Limpieza oportunista — Map.set sobrescribe pero entradas que jamás se
 * vuelven a consultar quedarían huérfanas. Llamar esporádicamente desde el
 * scheduler si el tráfico esperado es alto.
 */
export function pruneExpired(): void {
  const now = Date.now()
  for (const [k, v] of buckets.entries()) {
    if (v.resetAt <= now) buckets.delete(k)
  }
}
