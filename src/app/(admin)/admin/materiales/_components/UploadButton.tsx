"use client"

import { useRef, useState } from "react"
import { Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  folderId: string
  onComplete: () => void
}

type UploadState = {
  id: string
  name: string
  size: number
  uploaded: number
  status: "uploading" | "done" | "error"
  error?: string
}

/**
 * Subida por chunks reanudable (mini-tus contra disco local). El archivo se
 * parte en trozos de `chunkSize`; cada uno se sube por separado, así ninguna
 * petición individual es grande y no topa límites de proxy ni corta la conexión
 * HTTP/2 en archivos de GB. Si un chunk falla, se reintenta re-sincronizando el
 * offset con el servidor — la subida continúa donde quedó, no desde cero.
 *
 * Protocolo:
 *   POST   /session                 -> { uploadId, chunkSize }
 *   PATCH  /session/[id]            (header Upload-Offset, body = chunk)
 *   POST   /session/[id]/complete  -> archivo creado
 *   DELETE /session/[id]           (cancelar)
 */

const MAX_CHUNK_RETRIES = 5

type Controller = { uploadId: string | null; xhr: XMLHttpRequest | null; cancelled: boolean }

export function UploadButton({ folderId, onComplete }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<UploadState[]>([])
  const controllers = useRef<Record<string, Controller>>({})

  function pickFiles() {
    fileInputRef.current?.click()
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    Array.from(files).forEach((file) => void uploadOne(file))
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function patch(id: string, next: Partial<UploadState>) {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...next } : u)))
  }

  async function uploadOne(file: File) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const ctrl: Controller = { uploadId: null, xhr: null, cancelled: false }
    controllers.current[id] = ctrl

    setUploads((prev) => [
      ...prev,
      { id, name: file.name, size: file.size, uploaded: 0, status: "uploading" },
    ])

    try {
      // 1) Crear sesión.
      const createRes = await fetch("/api/materials/upload/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          folderId,
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        }),
      })
      if (!createRes.ok) throw new Error(await errorMessage(createRes))
      const { uploadId, chunkSize } = (await createRes.json()) as {
        uploadId: string
        chunkSize: number
      }
      ctrl.uploadId = uploadId
      if (ctrl.cancelled) return void cleanup(id)

      // 2) Subir chunks secuencialmente (con reintentos + re-sync de offset).
      let offset = 0
      while (offset < file.size) {
        if (ctrl.cancelled) return void cleanup(id)
        offset = await sendChunk(id, ctrl, uploadId, file, offset, chunkSize)
      }

      // 3) Finalizar.
      const completeRes = await fetch(`/api/materials/upload/session/${uploadId}/complete`, {
        method: "POST",
      })
      if (!completeRes.ok) throw new Error(await errorMessage(completeRes))

      patch(id, { status: "done", uploaded: file.size })
      delete controllers.current[id]
      onComplete()
    } catch (err) {
      if (ctrl.cancelled) return
      patch(id, { status: "error", error: err instanceof Error ? err.message : "Error de red" })
      delete controllers.current[id]
    }
  }

  /**
   * Sube el chunk que empieza en `startOffset`. Devuelve el offset confirmado
   * por el servidor (inicio del siguiente chunk). Ante fallo de red / 5xx / 409
   * consulta el offset real y reintenta desde ahí, con backoff exponencial.
   */
  async function sendChunk(
    id: string,
    ctrl: Controller,
    uploadId: string,
    file: File,
    startOffset: number,
    chunkSize: number,
  ): Promise<number> {
    let offset = startOffset
    for (let attempt = 0; ; attempt++) {
      if (ctrl.cancelled) throw new Aborted()
      const blob = file.slice(offset, Math.min(startOffset + chunkSize, file.size))
      try {
        return await putChunk(id, ctrl, uploadId, offset, blob)
      } catch (err) {
        if (err instanceof Aborted || ctrl.cancelled) throw err
        if (err instanceof Fatal) throw new Error(err.message)
        if (attempt >= MAX_CHUNK_RETRIES) {
          throw new Error(err instanceof Error ? err.message : "Falla al subir el chunk")
        }
        await sleep(Math.min(1000 * 2 ** attempt, 8000))
        // Re-sincroniza: el servidor es la fuente de verdad del offset.
        offset = await getServerOffset(uploadId)
        patch(id, { uploaded: offset })
        if (offset >= Math.min(startOffset + chunkSize, file.size)) return offset
      }
    }
  }

  /** Un intento de PATCH del chunk vía XHR (progreso byte a byte). */
  function putChunk(
    id: string,
    ctrl: Controller,
    uploadId: string,
    offset: number,
    blob: Blob,
  ): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      ctrl.xhr = xhr
      xhr.open("PATCH", `/api/materials/upload/session/${uploadId}`)
      xhr.setRequestHeader("Upload-Offset", String(offset))
      xhr.setRequestHeader("Content-Type", "application/octet-stream")

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) patch(id, { uploaded: offset + e.loaded })
      })
      xhr.addEventListener("load", () => {
        ctrl.xhr = null
        const body = safeJson(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(typeof body?.offset === "number" ? body.offset : offset + blob.size)
        } else if (xhr.status === 409 || xhr.status >= 500) {
          reject(new Error(body?.error ?? `Reintentable (${xhr.status})`)) // recuperable
        } else {
          reject(new Fatal(body?.error ?? `Falla (${xhr.status})`))
        }
      })
      xhr.addEventListener("error", () => {
        ctrl.xhr = null
        reject(new Error("Error de red"))
      })
      xhr.addEventListener("abort", () => {
        ctrl.xhr = null
        reject(new Aborted())
      })
      xhr.send(blob)
    })
  }

  function cancel(id: string) {
    const ctrl = controllers.current[id]
    if (ctrl) {
      ctrl.cancelled = true
      ctrl.xhr?.abort()
      if (ctrl.uploadId) {
        void fetch(`/api/materials/upload/session/${ctrl.uploadId}`, { method: "DELETE" })
      }
      delete controllers.current[id]
    }
    setUploads((prev) => prev.filter((u) => u.id !== id))
  }

  function cleanup(id: string) {
    const ctrl = controllers.current[id]
    if (ctrl?.uploadId) {
      void fetch(`/api/materials/upload/session/${ctrl.uploadId}`, { method: "DELETE" })
    }
    delete controllers.current[id]
    setUploads((prev) => prev.filter((u) => u.id !== id))
  }

  function dismiss(id: string) {
    setUploads((prev) => prev.filter((u) => u.id !== id))
  }

  const active = uploads.filter((u) => u.status !== "done")

  return (
    <>
      <Button variant="primary" size="md" onClick={pickFiles}>
        <Upload size={14} strokeWidth={1.6} />
        Subir archivos
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {uploads.length > 0 && (
        <div className="border-border bg-surface fixed right-4 bottom-4 z-30 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border shadow-md">
          <header className="border-border flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-foreground text-[13px] font-medium">
              {active.length > 0
                ? `Subiendo ${active.length} archivo${active.length === 1 ? "" : "s"}…`
                : "Subidas completadas"}
            </span>
            {active.length === 0 && (
              <button
                type="button"
                onClick={() => setUploads([])}
                className="text-text-3 hover:text-foreground rounded-md p-1 transition-colors"
                aria-label="Cerrar lista de subidas"
              >
                <X size={13} strokeWidth={1.6} />
              </button>
            )}
          </header>
          <ul className="divide-border max-h-[260px] divide-y overflow-y-auto">
            {uploads.map((u) => (
              <li key={u.id} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground truncate text-[13px]" title={u.name}>
                      {u.name}
                    </div>
                    <div className="text-text-3 mt-1 flex items-center justify-between font-mono text-[11.5px]">
                      <span>
                        {formatBytes(u.uploaded)} / {formatBytes(u.size)}
                      </span>
                      <span>
                        {u.status === "done"
                          ? "Listo"
                          : u.status === "error"
                            ? "Error"
                            : `${Math.round((u.uploaded / Math.max(u.size, 1)) * 100)}%`}
                      </span>
                    </div>
                    <div className="bg-bone-100 mt-1.5 h-1 w-full overflow-hidden rounded-full">
                      <div
                        className={
                          u.status === "error"
                            ? "bg-danger h-full"
                            : u.status === "done"
                              ? "h-full bg-teal-500"
                              : "h-full bg-teal-500/70"
                        }
                        style={{
                          width: `${u.status === "done" ? 100 : Math.min(100, (u.uploaded / Math.max(u.size, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    {u.error && <div className="text-danger mt-1 text-[11.5px]">{u.error}</div>}
                  </div>
                  {u.status === "uploading" ? (
                    <button
                      type="button"
                      onClick={() => cancel(u.id)}
                      className="text-text-3 hover:text-danger shrink-0 rounded-md p-1 transition-colors"
                      aria-label={`Cancelar ${u.name}`}
                    >
                      <X size={13} strokeWidth={1.6} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => dismiss(u.id)}
                      className="text-text-3 hover:text-foreground shrink-0 rounded-md p-1 transition-colors"
                      aria-label={`Descartar ${u.name}`}
                    >
                      <X size={13} strokeWidth={1.6} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

// -----------------------------------------------------------------------------
//  Helpers
// -----------------------------------------------------------------------------

/** Error fatal (4xx no recuperable): aborta la subida con este mensaje. */
class Fatal extends Error {}
/** El usuario canceló la subida. */
class Aborted extends Error {}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function getServerOffset(uploadId: string): Promise<number> {
  const res = await fetch(`/api/materials/upload/session/${uploadId}`)
  if (!res.ok) throw new Fatal(await errorMessage(res))
  const body = (await res.json()) as { offset: number }
  return body.offset
}

function safeJson(text: string): { offset?: number; error?: string } | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    if (body?.error) return body.error
  } catch {}
  return `Falla (${res.status})`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`
}
