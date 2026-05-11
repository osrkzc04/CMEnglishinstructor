"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Botón compacto para copiar al portapapeles. Devuelve feedback visual por
 * 1.5s cuando la copia funciona y un fallback simple si la API no está
 * disponible (HTTP no seguro, navegadores antiguos).
 */
type Props = {
  value: string
  /** Etiqueta accesible para lectores de pantalla. */
  label?: string
  className?: string
}

export function CopyButton({ value, label = "Copiar", className }: Props) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  async function handleCopy() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(value)
      } else {
        // Fallback: usar un textarea oculto y document.execCommand
        const ta = document.createElement("textarea")
        ta.value = value
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
      }
      setCopied(true)
      setError(false)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError(true)
      setTimeout(() => setError(false), 1500)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-md border border-border bg-surface px-2 py-1.5 text-[12.5px] text-text-2 transition-colors hover:border-teal-500 hover:text-teal-500",
        copied && "border-teal-500 text-teal-600",
        error && "border-danger/50 text-danger",
        className,
      )}
    >
      {copied ? (
        <Check size={12} strokeWidth={1.8} />
      ) : (
        <Copy size={12} strokeWidth={1.6} />
      )}
      {copied ? "Copiado" : error ? "Error" : "Copiar"}
    </button>
  )
}
