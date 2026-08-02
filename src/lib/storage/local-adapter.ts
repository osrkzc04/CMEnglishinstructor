import "server-only"
import path from "node:path"
import fs from "node:fs/promises"
import { createReadStream, createWriteStream } from "node:fs"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
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

  async upload(
    key: string,
    data: Buffer | Uint8Array | Blob,
  ): Promise<{ key: string; size: number }> {
    const fullPath = this.resolve(key)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    const buffer = data instanceof Blob ? Buffer.from(await data.arrayBuffer()) : Buffer.from(data)
    await fs.writeFile(fullPath, buffer)
    return { key, size: buffer.byteLength }
  }

  async uploadStream(
    key: string,
    input: Readable | ReadableStream<Uint8Array>,
  ): Promise<{ key: string; size: number }> {
    const fullPath = this.resolve(key)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })

    // Convertir Web ReadableStream a Node Readable si hace falta — Next 15
    // entrega `request.body` como ReadableStream.
    const source =
      input instanceof Readable
        ? input
        : Readable.fromWeb(input as unknown as import("node:stream/web").ReadableStream<Uint8Array>)

    const sink = createWriteStream(fullPath)
    let size = 0
    source.on("data", (chunk: Buffer) => {
      size += chunk.byteLength
    })

    try {
      await pipeline(source, sink)
    } catch (err) {
      // Limpieza si la subida se cortó a la mitad — evita basura en disco.
      await fs.unlink(fullPath).catch(() => {})
      throw err
    }
    return { key, size }
  }

  async appendChunk(
    key: string,
    input: Readable | ReadableStream<Uint8Array>,
  ): Promise<{ size: number }> {
    const fullPath = this.resolve(key)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })

    const source =
      input instanceof Readable
        ? input
        : Readable.fromWeb(input as unknown as import("node:stream/web").ReadableStream<Uint8Array>)

    // `flags: "a"` → anexa al final; crea el archivo si no existe.
    const sink = createWriteStream(fullPath, { flags: "a" })
    try {
      await pipeline(source, sink)
    } catch (err) {
      // No borramos el parcial: la subida es reanudable y el cliente puede
      // reintentar el chunk desde el offset ya persistido.
      throw err
    }
    const stat = await fs.stat(fullPath)
    return { size: stat.size }
  }

  async truncateTo(key: string, size: number): Promise<void> {
    const fullPath = this.resolve(key)
    try {
      await fs.truncate(fullPath, size)
    } catch (err) {
      // Si el blob todavía no existe, truncar a 0 es un no-op válido (el
      // primer chunk lo creará al anexar).
      if ((err as NodeJS.ErrnoException).code === "ENOENT" && size === 0) return
      throw err
    }
  }

  async promote(fromKey: string, toKey: string): Promise<{ size: number }> {
    const from = this.resolve(fromKey)
    const to = this.resolve(toKey)
    await fs.mkdir(path.dirname(to), { recursive: true })
    await fs.rename(from, to)
    const stat = await fs.stat(to)
    return { size: stat.size }
  }

  async getReadStream(key: string): Promise<{ stream: Readable; size: number }> {
    const fullPath = this.resolve(key)
    const stat = await fs.stat(fullPath)
    return { stream: createReadStream(fullPath), size: stat.size }
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
