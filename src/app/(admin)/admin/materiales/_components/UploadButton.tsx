"use client"

import { useRef, useState } from "react"
import { Loader2, Upload, X } from "lucide-react"
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
  xhr?: XMLHttpRequest
}

/**
 * Upload con XMLHttpRequest: es el camino más fiable para mostrar progreso
 * en archivos grandes. `fetch` con body=Blob no expone bytes-uploaded en
 * todos los navegadores y `request streams` requieren HTTP/2 + setup adicional.
 */
export function UploadButton({ folderId, onComplete }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<UploadState[]>([])

  function pickFiles() {
    fileInputRef.current?.click()
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    list.forEach((file) => uploadOne(file))
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function uploadOne(file: File) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const xhr = new XMLHttpRequest()

    setUploads((prev) => [
      ...prev,
      { id, name: file.name, size: file.size, uploaded: 0, status: "uploading", xhr },
    ])

    const url = `/api/materials/upload?folderId=${encodeURIComponent(folderId)}&name=${encodeURIComponent(file.name)}`
    xhr.open("POST", url)
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")

    xhr.upload.addEventListener("progress", (e) => {
      if (!e.lengthComputable) return
      setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, uploaded: e.loaded } : u)))
    })

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploads((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status: "done", uploaded: u.size } : u)),
        )
        onComplete()
      } else {
        let msg = `Falla (${xhr.status})`
        try {
          const body = JSON.parse(xhr.responseText)
          if (body?.error) msg = body.error
        } catch {}
        setUploads((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status: "error", error: msg } : u)),
        )
      }
    })

    xhr.addEventListener("error", () => {
      setUploads((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: "error", error: "Error de red" } : u)),
      )
    })

    xhr.addEventListener("abort", () => {
      setUploads((prev) => prev.filter((u) => u.id !== id))
    })

    xhr.send(file)
  }

  function cancel(id: string) {
    setUploads((prev) => {
      const target = prev.find((u) => u.id === id)
      target?.xhr?.abort()
      return prev.filter((u) => u.id !== id)
    })
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`
}
