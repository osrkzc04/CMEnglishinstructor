import { Check, ChevronDown, CircleHelp, Flag, Minus, X } from "lucide-react"
import { RichPrompt } from "@/components/ui/rich-prompt"
import { cn } from "@/lib/utils"
import type { ReviewDetail, ReviewQuestion } from "@/modules/tests/sessions/review-queries"

/**
 * Lista server-rendered con las preguntas y la respuesta del candidato.
 * Acá SÍ exponemos la opción correcta. Estados por pregunta:
 *
 *  - correct  → respuesta del candidato == correcta del banco
 *  - wrong    → respondió pero no coincide
 *  - blank    → no contestó (selectedOptionId / textAnswer null)
 *  - pending  → FILL_IN sin match en aceptadas → revisión humana
 *
 * Cada bloque (sectionOrder + cefrLevelCode) es un `<details>` plegable con un
 * resumen de aciertos en la cabecera. Se abren por defecto solo los que
 * requieren atención (preguntas por revisar o marcadas), para que la columna
 * no quede kilométrica y se llegue rápido al panel de la derecha.
 */

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const

type Props = {
  questions: ReviewDetail["questions"]
}

export function QuestionReviewList({ questions }: Props) {
  const groups = groupBySection(questions)

  return (
    <section className="space-y-4">
      {groups.map((group, index) => {
        const counts = countStatuses(group.questions)
        const needsAttention = counts.pending > 0 || group.questions.some((q) => q.markedForReview)
        // El primer bloque (orden ascendente) arranca desplegado; el resto
        // solo si requiere atención.
        const open = index === 0 || needsAttention

        return (
          <details
            key={group.key}
            open={open}
            className="group border-border bg-surface rounded-xl border"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <div className="flex items-baseline gap-2">
                <h3 className="text-foreground font-serif text-[18px] font-normal tracking-[-0.01em]">
                  Bloque {group.sectionOrder ?? "—"}{" "}
                  <span className="text-text-3 font-mono text-[12px] tracking-[0.02em] uppercase">
                    {group.cefrLevelCode ?? "Sin nivel"}
                  </span>
                </h3>
                <span className="text-text-3 font-mono text-[11.5px] tabular-nums">
                  {group.questions.length}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <CountSummary counts={counts} />
                <ChevronDown
                  size={16}
                  strokeWidth={1.7}
                  className="text-text-3 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </div>
            </summary>
            <ol className="border-border space-y-3 border-t p-5">
              {group.questions.map((q, idx) => (
                <QuestionRow key={q.id} q={q} numberInBlock={idx + 1} />
              ))}
            </ol>
          </details>
        )
      })}
    </section>
  )
}

function CountSummary({ counts }: { counts: StatusCounts }) {
  return (
    <span className="flex items-center gap-2 font-mono text-[11.5px] tabular-nums">
      {counts.correct > 0 && <span className="text-teal-500">{counts.correct} ✓</span>}
      {counts.wrong > 0 && <span className="text-danger">{counts.wrong} ✕</span>}
      {counts.pending > 0 && <span className="text-warning">{counts.pending} revisar</span>}
      {counts.blank > 0 && <span className="text-text-3">{counts.blank} en blanco</span>}
    </span>
  )
}

function QuestionRow({ q, numberInBlock }: { q: ReviewQuestion; numberInBlock: number }) {
  const status = deriveStatus(q)

  return (
    <li className="border-border bg-surface-alt rounded-lg border p-4">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
            Pregunta {q.order} · #{numberInBlock} del bloque
          </p>
          <RichPrompt
            content={q.prompt}
            className="text-foreground mt-1 font-serif text-[16px]"
          />
        </div>
        <div className="flex items-center gap-2">
          {q.markedForReview && (
            <span className="border-warning/40 bg-warning/[0.08] text-warning inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11.5px]">
              <Flag size={11} strokeWidth={1.7} />
              Marcada por el candidato
            </span>
          )}
          <StatusPill status={status} />
        </div>
      </header>

      {q.type === "MULTIPLE_CHOICE" && q.options && (
        <ul className="space-y-1.5">
          {q.options.map((opt, idx) => {
            const letter = LETTERS[idx] ?? String(idx + 1)
            const isSelected = q.selectedOptionId === opt.id
            const isCorrect = opt.isCorrect
            return (
              <li
                key={opt.id}
                className={cn(
                  "flex items-start gap-3 rounded-md border px-3 py-2.5 text-[14px]",
                  isCorrect
                    ? "border-teal-500/40 bg-teal-500/[0.06]"
                    : isSelected
                      ? "border-danger/40 bg-danger/[0.06]"
                      : "border-border bg-surface",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-md border font-mono text-[11px] font-medium",
                    isCorrect
                      ? "text-bone border-teal-500 bg-teal-500"
                      : isSelected
                        ? "text-bone border-danger bg-danger"
                        : "border-border bg-surface text-text-3",
                  )}
                >
                  {letter}
                </span>
                <span className="text-foreground flex-1">{opt.text}</span>
                <span className="text-text-3 flex items-center gap-2 font-mono text-[11.5px]">
                  {isCorrect && <span className="text-teal-500">Correcta</span>}
                  {isSelected && !isCorrect && <span className="text-danger">Respuesta</span>}
                  {isSelected && isCorrect && <span className="text-teal-500">✓ Respuesta</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {q.type === "FILL_IN" && (
        <div className="space-y-2">
          <div className="border-border bg-surface rounded-md border px-3 py-2">
            <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
              Respuesta del candidato
            </p>
            <p className="text-foreground mt-1 text-[14px]">
              {q.textAnswer && q.textAnswer.trim().length > 0 ? (
                q.textAnswer
              ) : (
                <span className="text-text-4 italic">Sin respuesta</span>
              )}
            </p>
          </div>
          {q.acceptedAnswers && q.acceptedAnswers.length > 0 && (
            <div className="border-border bg-surface rounded-md border px-3 py-2">
              <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
                Respuestas aceptadas
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {q.acceptedAnswers.map((a, i) => (
                  <li
                    key={i}
                    className="inline-flex items-center gap-1 rounded-md border border-teal-500/40 bg-teal-500/[0.06] px-2 py-0.5 font-mono text-[12px] text-teal-500"
                  >
                    {a.answer}
                    {a.caseSensitive && (
                      <span className="text-text-3" title="Sensible a mayúsculas">
                        Aa
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

type Status = "correct" | "wrong" | "blank" | "pending"

type StatusCounts = { correct: number; wrong: number; blank: number; pending: number }

function countStatuses(questions: ReviewQuestion[]): StatusCounts {
  const counts: StatusCounts = { correct: 0, wrong: 0, blank: 0, pending: 0 }
  for (const q of questions) counts[deriveStatus(q)] += 1
  return counts
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { label: string; icon: React.ReactNode; className: string }> = {
    correct: {
      label: "Correcta",
      icon: <Check size={11} strokeWidth={1.9} />,
      className: "border-teal-500/40 bg-teal-500/[0.08] text-teal-500",
    },
    wrong: {
      label: "Incorrecta",
      icon: <X size={11} strokeWidth={1.9} />,
      className: "border-danger/40 bg-danger/[0.08] text-danger",
    },
    blank: {
      label: "Sin responder",
      icon: <Minus size={11} strokeWidth={1.9} />,
      className: "border-border bg-surface text-text-3",
    },
    pending: {
      label: "Revisar",
      icon: <CircleHelp size={11} strokeWidth={1.9} />,
      className: "border-warning/40 bg-warning/[0.08] text-warning",
    },
  }
  const cfg = map[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[11.5px]",
        cfg.className,
      )}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

function deriveStatus(q: ReviewQuestion): Status {
  if (q.type === "MULTIPLE_CHOICE") {
    if (q.selectedOptionId === null) return "blank"
    return q.isCorrect === true ? "correct" : "wrong"
  }
  // FILL_IN
  const empty = !q.textAnswer || q.textAnswer.trim().length === 0
  if (empty) return "blank"
  if (q.isCorrect === true) return "correct"
  if (q.isCorrect === false) return "wrong"
  return "pending"
}

function groupBySection(questions: ReviewQuestion[]): {
  key: string
  sectionOrder: number | null
  cefrLevelCode: string | null
  questions: ReviewQuestion[]
}[] {
  const map = new Map<string, ReviewQuestion[]>()
  for (const q of questions) {
    const key = `${q.sectionOrder ?? "none"}::${q.cefrLevelCode ?? "none"}`
    const arr = map.get(key) ?? []
    arr.push(q)
    map.set(key, arr)
  }
  return Array.from(map.entries())
    .map(([key, qs]) => ({
      key,
      sectionOrder: qs[0]?.sectionOrder ?? null,
      cefrLevelCode: qs[0]?.cefrLevelCode ?? null,
      questions: qs.sort((a, b) => a.order - b.order),
    }))
    .sort((a, b) => (a.sectionOrder ?? 99) - (b.sectionOrder ?? 99))
}
