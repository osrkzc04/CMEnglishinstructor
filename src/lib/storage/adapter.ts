import "server-only"

/**
 * Interfaz abstracta para el storage de archivos.
 * Permite cambiar entre disco local y Cloudflare R2 sin tocar lógica de negocio.
 *
 * En la DB se guarda solo `key` (string identificador), nunca URL absoluta.
 */

export interface StorageAdapter {
  /**
   * Sube un archivo y devuelve la key con la que se puede recuperar.
   * @param key — key relativa (ej: `applications/abc123/cv.pdf`)
   * @param data — el archivo como Buffer, Uint8Array o stream
   * @param options — content type opcional
   */
  upload(
    key: string,
    data: Buffer | Uint8Array | Blob,
    options?: { contentType?: string },
  ): Promise<{ key: string; size: number }>

  /**
   * Genera una URL para acceder al archivo.
   * En local devuelve URL absoluta a /api/files/[key].
   * En R2 devuelve una signed URL si el bucket es privado, o pública si tiene CDN.
   * @param expiresInSeconds — TTL para URLs firmadas (ignorado en local)
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
