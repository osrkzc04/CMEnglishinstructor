/**
 * Código Node-only del hook de instrumentación.
 *
 * Vive en un archivo separado de `instrumentation.ts` porque el bundle Edge
 * incluye `instrumentation.ts` y analiza estáticamente todo su grafo de
 * imports — si nodemailer (o cualquier dep Node-only) aparece transitivamente
 * acá, el build de Edge falla con "Module not found: 'crypto' / 'fs' / 'net'".
 *
 * Importado dinámicamente solo cuando `process.env.NEXT_RUNTIME === "nodejs"`.
 */

import {
  startEmailRetryScheduler,
  startSessionMaterializeScheduler,
  startAutoCloseStaleScheduler,
} from "./lib/jobs/scheduler"

export function registerNode(): void {
  startEmailRetryScheduler()
  startSessionMaterializeScheduler()
  startAutoCloseStaleScheduler()
}
