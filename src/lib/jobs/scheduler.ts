import "server-only"

/**
 * Scheduler in-process para jobs periódicos.
 *
 * Jobs registrados hoy:
 *   - Retry de emails fallidos (cada 15 min).
 *   - Materialización de sesiones de aulas activas (cada 7 días).
 *   - Auto-cierre de sesiones sin registro (cada 5 min).
 *
 * Por qué in-process en lugar de un worker dedicado:
 *  - Hosting Node sin servicios externos (cPanel / Plesk / VPS chico).
 *  - Carga de los jobs es despreciable (decenas de queries por intervalo).
 *  - Una sola instancia → no hay duplicación.
 *
 * Si más adelante hace falta escalar a varias instancias, mover a cron del
 * sistema o a un worker separado para evitar que el job corra N veces.
 *
 * En dev se deshabilitan: contamina logs, mantiene conexiones vivas a la
 * DB y choca con providers que auto-suspenden (Neon free, etc.). Para
 * testear el flujo desde dev, pegar a los endpoints HTTP correspondientes
 * con `Authorization: Bearer $CRON_SECRET`.
 */

// Procesa la cola de emails (QUEUED + FAILED). El primer intento de cada
// email es asíncrono ahora — `deliverEmail` solo encola y dispara un
// setImmediate. Este intervalo es el fallback periódico por si ese trigger
// falla o si el proceso se reinició con emails sin enviar.
const RETRY_INTERVAL_MS = 5 * 60 * 1000 // 5 min
const MATERIALIZE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // 7 días
const AUTO_CLOSE_INTERVAL_MS = 5 * 60 * 1000 // 5 min

// Guardamos las referencias globalmente para sobrevivir a reloads de HMR
// en dev sin acumular intervalos huérfanos. En prod el módulo se carga
// una sola vez y este pattern es un no-op.
declare global {
  // eslint-disable-next-line no-var
  var __cmEmailRetryHandle: NodeJS.Timeout | undefined
  // eslint-disable-next-line no-var
  var __cmMaterializeHandle: NodeJS.Timeout | undefined
  // eslint-disable-next-line no-var
  var __cmAutoCloseHandle: NodeJS.Timeout | undefined
}

export function startEmailRetryScheduler(): void {
  if (process.env.NODE_ENV !== "production") return

  if (globalThis.__cmEmailRetryHandle) {
    clearInterval(globalThis.__cmEmailRetryHandle)
  }

  globalThis.__cmEmailRetryHandle = setInterval(async () => {
    try {
      const { retryFailedEmails } = await import("@/modules/auth/retryFailedEmails")
      const result = await retryFailedEmails()
      if (result.attempted > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[email-retry] attempted=${result.attempted} ok=${result.succeeded} fail=${result.failed} cancel=${result.cancelled}`,
        )
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[email-retry] error inesperado:", err)
    }
  }, RETRY_INTERVAL_MS)

  globalThis.__cmEmailRetryHandle.unref?.()
}

export function startSessionMaterializeScheduler(): void {
  if (process.env.NODE_ENV !== "production") return

  if (globalThis.__cmMaterializeHandle) {
    clearInterval(globalThis.__cmMaterializeHandle)
  }

  // Corrida inicial al boot — si el server lleva días caído, el cron
  // semanal tardaría una semana en disparar. Mejor compensar al arrancar.
  // La idempotencia del materializer lo hace seguro de correr más seguido
  // de lo planeado.
  void runMaterializeOnce()

  globalThis.__cmMaterializeHandle = setInterval(() => {
    void runMaterializeOnce()
  }, MATERIALIZE_INTERVAL_MS)

  globalThis.__cmMaterializeHandle.unref?.()
}

async function runMaterializeOnce(): Promise<void> {
  try {
    const { materializeUpcomingForAllActive } =
      await import("@/modules/classGroups/materializeUpcoming")
    const summary = await materializeUpcomingForAllActive()
    if (summary.groupsProcessed > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[materialize] groups=${summary.groupsProcessed} created=${summary.totalCreated} skipped=${summary.totalSkipped} errors=${summary.errors.length}`,
      )
      if (summary.errors.length > 0) {
        // eslint-disable-next-line no-console
        console.warn("[materialize] errores:", summary.errors)
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[materialize] error inesperado:", err)
  }
}

export function startAutoCloseStaleScheduler(): void {
  if (process.env.NODE_ENV !== "production") return

  if (globalThis.__cmAutoCloseHandle) {
    clearInterval(globalThis.__cmAutoCloseHandle)
  }

  // Corrida inicial al boot — recoger sesiones que quedaron stale mientras
  // el server estaba caído. El job es idempotente y barato.
  void runAutoCloseOnce()

  globalThis.__cmAutoCloseHandle = setInterval(() => {
    void runAutoCloseOnce()
  }, AUTO_CLOSE_INTERVAL_MS)

  globalThis.__cmAutoCloseHandle.unref?.()
}

async function runAutoCloseOnce(): Promise<void> {
  try {
    const { autoCloseStaleSessions } = await import("@/modules/classes/autoCloseStaleSessions")
    const summary = await autoCloseStaleSessions()
    if (summary.closed > 0) {
      // eslint-disable-next-line no-console
      console.log(`[auto-close] closed=${summary.closed} ids=${summary.sessionIds.join(",")}`)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[auto-close] error inesperado:", err)
  }
}
