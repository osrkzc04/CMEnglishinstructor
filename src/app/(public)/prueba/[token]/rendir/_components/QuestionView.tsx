"use client"

import { Flag } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Render de una pregunta de placement test. Soporta MULTIPLE_CHOICE (única
 * tipo usada en placement) y FILL_IN para flexibilidad.
 *
 * Las letras a/b/c/d se generan desde el `order` de cada opción — no se
 * almacenan. Esto permite que el mismo componente sirva con N opciones.
 */

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const

export type QuestionOption = {
  id: string
  text: string
  order: number
}

export function QuestionView({
  globalNumber,
  totalInSection,
  prompt,
  type,
  options,
  selectedOptionId,
  textAnswer,
  markedForReview,
  onSelectOption,
  onChangeText,
  onToggleReview,
}: {
  globalNumber: number
  totalInSection: number
  prompt: string
  type: "MULTIPLE_CHOICE" | "FILL_IN"
  options: QuestionOption[] | null
  selectedOptionId: string | null
  textAnswer: string | null
  markedForReview: boolean
  onSelectOption: (id: string) => void
  onChangeText: (value: string) => void
  onToggleReview: () => void
}) {
  return (
    <div className="border-border bg-surface rounded-xl border px-6 py-7 sm:px-8 sm:py-9">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
          Pregunta {globalNumber} de {totalInSection} del bloque
        </p>
        <button
          type="button"
          onClick={onToggleReview}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-colors",
            markedForReview
              ? "border-warning/50 bg-warning/[0.08] text-warning"
              : "border-border bg-surface text-text-3 hover:border-warning/40 hover:text-warning",
          )}
          aria-pressed={markedForReview}
        >
          <Flag size={12} strokeWidth={1.7} />
          {markedForReview ? "Marcada para revisar" : "Marcar para revisar"}
        </button>
      </div>

      <p className="text-foreground font-serif text-[18px] leading-[1.55] tracking-[-0.005em] sm:text-[20px]">
        {prompt}
      </p>

      {type === "MULTIPLE_CHOICE" && options && (
        <ul className="mt-6 space-y-2">
          {options
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((opt, idx) => {
              const isSelected = opt.id === selectedOptionId
              const letter = LETTERS[idx] ?? String(idx + 1)
              return (
                <li key={opt.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors",
                      isSelected
                        ? "border-teal-500 bg-teal-500/[0.06]"
                        : "border-border bg-surface hover:border-border-strong",
                    )}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name={`q-${globalNumber}`}
                      checked={isSelected}
                      onChange={() => onSelectOption(opt.id)}
                    />
                    <span
                      className={cn(
                        "mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-md border font-mono text-[12px] font-medium",
                        isSelected
                          ? "text-bone border-teal-500 bg-teal-500"
                          : "border-border bg-surface text-text-3",
                      )}
                    >
                      {letter}
                    </span>
                    <span className="text-foreground text-[15px] leading-[1.5]">{opt.text}</span>
                  </label>
                </li>
              )
            })}
        </ul>
      )}

      {type === "FILL_IN" && (
        <div className="mt-6">
          <input
            type="text"
            value={textAnswer ?? ""}
            onChange={(e) => onChangeText(e.target.value)}
            className="border-border bg-surface text-foreground block w-full rounded-md border px-3 py-2.5 text-[15px] focus:border-teal-500 focus:outline-none"
            placeholder="Escribe tu respuesta"
            aria-label="Respuesta"
            autoComplete="off"
          />
        </div>
      )}
    </div>
  )
}
