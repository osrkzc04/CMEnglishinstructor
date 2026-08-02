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
   * Anexa un chunk al final del blob `key` (lo crea si no existe) sin bufferear
   * en memoria. Usado por la subida por chunks reanudable: cada PATCH agrega su
   * trozo. Devuelve el tamaño TOTAL del blob tras anexar.
   *
   * Mapeo futuro a R2: equivale a `UploadPart` de un multipart upload.
   */
  appendChunk(key: string, stream: Readable | ReadableStream<Uint8Array>): Promise<{ size: number }>

  /**
   * Trunca (o deja igual) el blob `key` a exactamente `size` bytes. Usado antes
   * de anexar un chunk para descartar bytes parciales que hayan quedado de un
   * intento fallido, manteniendo disco y BD sincronizados. No-op si el blob no
   * existe y `size` es 0.
   */
  truncateTo(key: string, size: number): Promise<void>

  /**
   * Mueve un blob de `fromKey` a `toKey` (atómico cuando es posible, sin copiar
   * los bytes). Usado al completar una subida por chunks: promueve el temporal
   * al key final. Devuelve el tamaño del blob resultante.
   *
   * Mapeo futuro a R2: equivale a `CompleteMultipartUpload` (o copy + delete).
   */
  promote(fromKey: string, toKey: string): Promise<{ size: number }>

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
