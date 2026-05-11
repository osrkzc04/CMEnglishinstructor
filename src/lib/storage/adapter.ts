import "server-only"
import type { Readable } from "node:stream"

/**
 * Interfaz abstracta para el storage de archivos.
 * Permite cambiar entre disco local y Cloudflare R2 sin tocar lógica de negocio.
 *
 * En la DB se guarda solo `key` (string identificador), nunca URL absoluta.
 *
 * Para archivos chicos (avatares, CVs) usar `upload(buffer)`. Para archivos
 * grandes (>100MB, ZIPs de cursos) usar `uploadStream` para evitar buffering
 * en memoria. La descarga grande usa `getReadStream`.
 */

export interface StorageAdapter {
  /**
   * Sube un archivo desde un buffer/blob. Conveniente para archivos chicos.
   * No usar para >100MB — buffereaba todo el archivo en memoria.
   */
  upload(
    key: string,
    data: Buffer | Uint8Array | Blob,
    options?: { contentType?: string },
  ): Promise<{ key: string; size: number }>

  /**
   * Sube un archivo desde un stream sin buffering. Para archivos grandes.
   * Devuelve los bytes recibidos.
   */
  uploadStream(
    key: string,
    stream: Readable | ReadableStream<Uint8Array>,
    options?: { contentType?: string },
  ): Promise<{ key: string; size: number }>

  /**
   * Devuelve un Node Readable para servir el archivo al cliente sin cargar
   * todo a memoria. Tira si el archivo no existe.
   */
  getReadStream(key: string): Promise<{ stream: Readable; size: number }>

  /**
   * Genera una URL para acceder al archivo.
   * En local devuelve URL absoluta a /api/files/[key].
   * En R2 devuelve una signed URL si el bucket es privado, o pública si tiene CDN.
   */
  getUrl(key: string, options?: { expiresInSeconds?: number }): Promise<string>

  /**
   * Elimina el archivo. No falla si no existe (idempotente).
   */
  delete(key: string): Promise<void>

  /**
   * Verifica existencia.
   */
  exists(key: string): Promise<boolean>
}
