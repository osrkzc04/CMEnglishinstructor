"use client"

import * as React from "react"
import { Bold, Eye, Italic, PencilLine } from "lucide-react"
import { cn } from "@/lib/utils"
import { RichPrompt } from "./rich-prompt"

/**
 * Editor de texto enriquecido ligero. UX:
 *
 *  - Textarea estándar (texto plano por debajo) con una barra de botones N / I.
 *  - Seleccionar texto + click en botón (o Ctrl+B / Ctrl+I) envuelve la
 *    selección con `**...**` o `*...*`. Si no hay selección, inserta los
 *    marcadores y deja el caret entre ellos.
 *  - Toggle "Vista previa" arriba a la derecha alterna entre editar y ver el
 *    render del [[rich-prompt]].
 *
 * Pensado para usarse con react-hook-form vía `<Controller>` — necesitamos
 * acceso a `value` / `onChange` para manipular la selección del textarea, así
 * que no se compone bien con `register()`.
 *
 * Storage: el `prompt` sigue siendo string en DB. Eso preserva snapshots,
 * importador CSV y queries simples — sólo cambia el render.
 */

type Props = {
  id?: string
  value: string
  onChange: (next: string) => void
  rows?: number
  placeholder?: string
  ariaInvalid?: boolean
}

export function RichPromptEditor({
  id,
  value,
  onChange,
  rows = 10,
  placeholder,
  ariaInvalid,
}: Props) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const [mode, setMode] = React.useState<"edit" | "preview">("edit")

  const wrap = (marker: "**" | "*") => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const before = value.slice(0, start)
    const selected = value.slice(start, end)
    const after = value.slice(end)
    const next = `${before}${marker}${selected}${marker}${after}`
    onChange(next)
    // Restablecer el caret/selección dentro del marcador tras el render.
    requestAnimationFrame(() => {
      if (!textareaRef.current) return
      textareaRef.current.focus()
      const offset = marker.length
      if (selected.length === 0) {
        const caret = start + offset
        textareaRef.current.setSelectionRange(caret, caret)
      } else {
        textareaRef.current.setSelectionRange(start + offset, end + offset)
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return
    const k = e.key.toLowerCase()
    if (k === "b") {
      e.preventDefault()
      wrap("**")
    } else if (k === "i") {
      e.preventDefault()
      wrap("*")
    }
  }

  return (
    <div
      className={cn(
        "border-border bg-surface overflow-hidden rounded-lg border",
        ariaInvalid && "border-danger",
      )}
    >
      <div className="border-border bg-surface-alt flex items-center justify-between gap-2 border-b px-2 py-1.5">
        <div className="flex items-center gap-1">
          <ToolbarButton
            label="Negrita (Ctrl+B)"
            disabled={mode === "preview"}
            onClick={() => wrap("**")}
          >
            <Bold size={14} strokeWidth={1.9} />
          </ToolbarButton>
          <ToolbarButton
            label="Cursiva (Ctrl+I)"
            disabled={mode === "preview"}
            onClick={() => wrap("*")}
          >
            <Italic size={14} strokeWidth={1.9} />
          </ToolbarButton>
        </div>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "edit" ? "preview" : "edit"))}
          className={cn(
            "text-text-2 hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11.5px] transition-colors",
            mode === "preview" && "text-foreground bg-teal-500/[0.08]",
          )}
          aria-pressed={mode === "preview"}
        >
          {mode === "edit" ? (
            <>
              <Eye size={12} strokeWidth={1.8} />
              Vista previa
            </>
          ) : (
            <>
              <PencilLine size={12} strokeWidth={1.8} />
              Editar
            </>
          )}
        </button>
      </div>

      {mode === "edit" ? (
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-invalid={ariaInvalid || undefined}
          className={cn(
            "bg-surface text-foreground placeholder:text-text-4 block w-full resize-y px-3.5 py-3 text-[14px] leading-[1.55]",
            "border-0 outline-none focus:outline-none",
            "min-h-[160px]",
          )}
        />
      ) : (
        <div className="bg-surface px-3.5 py-3">
          {value.trim().length > 0 ? (
            <RichPrompt content={value} className="text-foreground text-[14px]" />
          ) : (
            <p className="text-text-4 text-[14px] italic">Sin contenido</p>
          )}
        </div>
      )}
    </div>
  )
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "text-text-2 hover:text-foreground hover:bg-surface inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      {children}
    </button>
  )
}
