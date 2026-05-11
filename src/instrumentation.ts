/**
 * Hook de boot de Next.js — corre una vez por arranque del proceso Node.
 * Ver https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Aquí registramos los jobs in-process (cron) que corren mientras el
 * servidor está vivo. No requieren servicio externo (Vercel Cron, etc.) —
 * funcionan en cualquier hosting Node con `next start`.
 *
 * Importante: este archivo se compila para ambos runtimes (Node y Edge).
 * Todo el código Node-only (nodemailer, prisma, jobs) vive en
 * `./instrumentation-node.ts` y se importa dinámicamente solo cuando
 * `NEXT_RUNTIME === "nodejs"`. Así el bundle Edge nunca toca esos módulos
 * y el build no falla por `require("fs"|"crypto"|...)`.
 *
 * Notas:
 *  - Si el proceso reinicia, el intervalo se reinicia (no hay catch-up,
 *    pero la próxima corrida normal levanta lo pendiente).
 *  - Si la app corre con varias instancias detrás de un balanceador, cada
 *    una correrá el job en paralelo. Para escalas chicas (academia con
 *    1 instancia) es despreciable; si crece, mover a cron del sistema.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node")
    registerNode()
  }
}
