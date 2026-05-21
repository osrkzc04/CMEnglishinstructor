"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

/**
 * Botón para copiar al portapapeles el link de invitación. Muestra feedback
 * de 1.5s al copiar exitosamente. Útil cuando el candidato no recibe el
 * correo (filtrado por spam, dirección equivocada) y coordinación necesita
 * pasarle el link por otro canal (WhatsApp, llamada).
 */
export function CopyLinkButton({
  link,
  label = "Copiar enlace",
}: {
  link: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback: select + copy via execCommand para navegadores con
      // clipboard API bloqueada (ej. contextos no-https).
      const t = document.createElement("textarea")
      t.value = link
      t.setAttribute("readonly", "")
      t.style.position = "fixed"
      t.style.opacity = "0"
      document.body.appendChild(t)
      t.select()
      try {
        document.execCommand("copy")
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      } finally {
        t.remove()
      }
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={copied ? "¡Copiado!" : label}
      className="border-border bg-surface text-text-3 grid h-7 w-7 place-items-center rounded-md border transition-colors hover:border-teal-500 hover:text-teal-500"
    >
      {copied ? (
        <Check size={13} strokeWidth={1.8} className="text-teal-500" />
      ) : (
        <Copy size={13} strokeWidth={1.6} />
      )}
    </button>
  )
}
