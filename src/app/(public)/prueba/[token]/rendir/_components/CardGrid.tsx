"use client"

import { Flag } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Grid de tarjetas numeradas — funciona como paginación + indicador visual
 * de estado por pregunta. Solo se muestran tarjetas de secciones desbloqueadas.
 *
 * Colores:
 *  - default (gris): sin responder
 *  - teal: respondida
 *  - warning + flag: respondida y marcada para revisar
 *  - bordered teal: pregunta actual
 *  - locked (opaca, no clickable): sección bloqueada (sección anterior commiteada)
 */

export type CardState = {
  globalNumber: number
  questionOrder: number
  isAnswered: boolean
  isMarkedForReview: boolean
  isCurrent: boolean
  isLocked: boolean
}

export type SectionRange = {
  order: number
  isCurrent: boolean
  isUnlocked: boolean
  cardRange: { start: number; end: number } | null
  totalQuestions: number
  answeredQuestions: number
}

export function CardGrid({
  sections,
  cards,
  onSelect,
}: {
  sections: SectionRange[]
  cards: CardState[]
  onSelect: (questionOrder: number) => void
}) {
  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const sectionCards = section.cardRange
          ? cards.filter(
              (c) =>
                c.globalNumber >= section.cardRange!.start &&
                c.globalNumber <= section.cardRange!.end,
            )
          : []

        return (
          <div key={section.order}>
            {section.isUnlocked ? (
              <>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
                    {section.isCurrent ? "Bloque actual" : "Bloque completado"}
                  </p>
                  {section.isCurrent && (
                    <p className="text-text-3 font-mono text-[11px] tabular-nums">
                      {section.answeredQuestions}/{section.totalQuestions}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
                  {sectionCards.map((card) => (
                    <CardButton
                      key={card.globalNumber}
                      card={card}
                      onClick={() => onSelect(card.questionOrder)}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function CardButton({ card, onClick }: { card: CardState; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={card.isLocked}
      aria-label={`Pregunta ${card.globalNumber}${
        card.isAnswered ? " (respondida)" : ""
      }${card.isMarkedForReview ? " (marcada para revisar)" : ""}${
        card.isCurrent ? " (actual)" : ""
      }`}
      title={
        card.isLocked ? "Bloque anterior — solo lectura" : `Ir a pregunta ${card.globalNumber}`
      }
      className={cn(
        "relative grid h-10 place-items-center rounded-md border text-[13px] font-medium tabular-nums transition-colors",
        card.isCurrent && "ring-offset-bone ring-2 ring-teal-500 ring-offset-1",
        card.isLocked
          ? "border-border bg-surface text-text-4 cursor-not-allowed opacity-60"
          : card.isMarkedForReview
            ? "border-warning/50 bg-warning/[0.1] text-warning hover:border-warning"
            : card.isAnswered
              ? "border-teal-500/50 bg-teal-500/[0.1] text-teal-500 hover:border-teal-500"
              : "border-border bg-surface text-text-2 hover:border-border-strong",
      )}
    >
      <span>{card.globalNumber}</span>
      {card.isMarkedForReview && (
        <Flag size={9} strokeWidth={2} className="absolute top-0.5 right-0.5" aria-hidden="true" />
      )}
    </button>
  )
}
