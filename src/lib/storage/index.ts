import "server-only"
import { env } from "@/lib/env"
import type { StorageAdapter } from "./adapter"
import { LocalAdapter } from "./local-adapter"

let instance: StorageAdapter | null = null

/**
 * Devuelve el StorageAdapter activo según `STORAGE_DRIVER`.
 * Singleton por proceso.
 */
export function storage(): StorageAdapter {
  if (instance) return instance
  switch (env.STORAGE_DRIVER) {
    case "local":
      instance = new LocalAdapter()
      return instance
    case "r2":
      // TODO: implementar R2Adapter cuando se migre.
      // import { R2Adapter } from './r2-adapter'
      // instance = new R2Adapter({ ... })
      throw new Error("R2 adapter no implementado todavía. STORAGE_DRIVER=r2 pendiente.")
    default:
      throw new Error(`STORAGE_DRIVER desconocido: ${env.STORAGE_DRIVER}`)
  }
}

export type { StorageAdapter } from "./adapter"
