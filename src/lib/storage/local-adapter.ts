import "server-only"
import path from "node:path"
import fs from "node:fs/promises"
import { env } from "@/lib/env"
import type { StorageAdapter } from "./adapter"

/**
 * Implementación de StorageAdapter usando disco local.
 * Útil para desarrollo y para deployments que no quieren depender de cloud
 * storage al inicio.
 *
 * Los archivos se sirven vía /api/files/[...key] (route handler que valida
 * autorización antes de stream-ear el archivo).
 */
export class LocalAdapter implements StorageAdapter {
  private readonly root: string

  constructor(root: string = env.LOCAL_STORAGE_PATH) {
    this.root = path.resolve(root)
  }

  private resolve(key: string): string {
    // Prevenir path traversal (../etc/passwd)
    const normalized = path.normalize(key).replace(/^(\.\.[/\\])+/, "")
    return path.join(this.root, normalized)
  }

  async upload(key: string, data: Buffer | Uint8Array | Blob): Promise<{ key: string; size: number }> {
    const fullPath = this.resolve(key)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    const buffer = data instanceof Blob ? Buffer.from(await data.arrayBuffer()) : Buffer.from(data)
    await fs.writeFile(fullPath, buffer)
    return { key, size: buffer.byteLength }
  }

  async getUrl(key: string): Promise<string> {
    return `/api/files/${encodeURIComponent(key)}`
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key))
      return true
    } catch {
      return false
    }
  }
}
