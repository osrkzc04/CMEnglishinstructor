import type { Metadata } from "next"
import { Check, Clock, Minus, X } from "lucide-react"

import { BrandMark, BrandWordmark } from "@/components/layout/BrandMark"
import { RichPrompt } from "@/components/ui/rich-prompt"
import { cn } from "@/lib/utils"
import {
  getResultsByToken,
  type ResultsQuestion,
} from "@/modules/tests/sessions/results-queries"

/**
 * `/resultados/[token]` — vista pública para el candidato.
 *
 * Tras la revisión humana se le envió un correo con un link válido por 12 h.
 * Esta página muestra:
 *  - Nombre, plantilla, fecha de revisión.
 *  - Puntaje total (aciertos / respondidas + %).
 *  - Lista pregunta-por-pregunta con la respuesta marcada y la correcta.
 *  - Observaciones que el revisor decidió compartir.
 *
 * Lo que NO se expone:
 *  - Nivel CEFR asignado (queda interno, coordinación lo conversa).
 *  - Notas R/W/L/S sobre 100.
 *  - El code de sección (A1/A2/etc.) — el candidato no lo necesita.
 *
 * Estados manejados:
 *  - Token no existe → tarjeta neutra "enlace inválido".
 *  - Token vencido (>12 h o resultsTokenExpiresAt en el pasado) → tarjeta
 *    "enlace vencido".
 *  - Sesión todavía no revisada → tarjeta "todavía no listo".
 */

export const metadata: Metadata = { title: "Resultado de evaluación" }

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "America/Guayaquil",
})

const fullFormatter = new Intl.DateTimeFormat("es-EC", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
})

type RouteParams = { token: string }

export default async function ResultadoPage({ params }: { params: Promise<RouteParams> }) {
  const { token } = await params
  const result = await getResultsByToken(token)

  if (!result.ok) {
    return <ResultErrorCard reason={result.reason} />
  }

  const { data } = result
  const firstName = data.candidateName.split(" ")[0]
  const globalPct =
    data.totalAnswered === 0 ? 0 : Math.round((data.totalCorrect / data.totalAnswered) * 100)

  return (
    <main className="bg-background flex min-h-screen flex-col px-4 py-10">
      <header className="mb-10 flex items-center justify-center gap-3">
        <BrandMark className="text-foreground" size={28} />
        <BrandWordmark className="text-foreground" size="md" />
      </header>

      <div className="mx-auto w-full max-w-[720px] flex-1">
        <div className="border-border bg-surface rounded-xl border px-8 py-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-teal-500/[0.1] text-teal-500">
            <Check size={26} strokeWidth={1.8} />
          </span>
          <h1 className="text-foreground mt-5 text-center font-serif text-[28px] leading-[1.18] font-normal tracking-[-0.02em]">
            Tu evaluación está lista, {firstName}
          </h1>
          <p className="text-text-2 mt-3 text-center text-[14px] leading-[1.6]">
            Revisamos tu evaluación de ubicación. Coordinación se va a contactar contigo para
            conversar sobre el siguiente paso y los programas que mejor se ajustan a ti.
          </p>

          <div className="border-border mt-7 grid gap-4 border-y py-5 sm:grid-cols-2">
            <Field label="Evaluación" value={data.templateName} />
            <Field label="Revisada" value={dateFormatter.format(data.reviewedAt)} />
          </div>

          {data.totalAnswered > 0 && (
            <section className="mt-6">
              <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
                Puntaje total
              </p>
              <div className="border-border mt-3 flex items-baseline justify-between border-b pb-4">
                <span className="text-foreground font-mono text-[20px] tabular-nums">
                  {data.totalCorrect} / {data.totalAnswered}
                </span>
                <span className="text-text-2 font-mono text-[13px] tabular-nums">
                  {globalPct}% de aciertos
                </span>
              </div>
            </section>
          )}

          {data.reviewerNotes && (
            <section className="mt-6">
              <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
                Observaciones
              </p>
              <p className="text-foreground mt-2 text-[14px] leading-[1.6] whitespace-pre-line">
                {data.reviewerNotes}
              </p>
            </section>
          )}
        </div>

        {data.questions.length > 0 && (
          <section className="mt-8">
            <h2 className="text-foreground font-serif text-[22px] leading-[1.2] font-normal tracking-[-0.01em]">
              Detalle de tus respuestas
            </h2>
            <p className="text-text-3 mt-2 text-[13px] leading-[1.55]">
              Estas son las preguntas que respondiste. Para cada una verás tu respuesta y la
              correcta.
            </p>
            <ol className="mt-5 space-y-3">
              {data.questions.map((q, idx) => (
                <QuestionRow key={q.id} q={q} displayNumber={idx + 1} />
              ))}
            </ol>
          </section>
        )}

        <p className="text-text-3 mt-8 flex items-center justify-center gap-2 text-center text-[12.5px]">
          <Clock size={12} strokeWidth={1.6} />
          Este enlace queda disponible hasta el {fullFormatter.format(data.expiresAt)}
        </p>
      </div>
    </main>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">{label}</p>
      <p className="text-foreground mt-1 text-[14px] leading-[1.5]">{value}</p>
    </div>
  )
}

type Status = "correct" | "wrong" | "blank"

function deriveStatus(q: ResultsQuestion): Status {
  if (q.type === "MULTIPLE_CHOICE") {
    if (q.selectedOptionId === null) return "blank"
    return q.isCorrect === true ? "correct" : "wrong"
  }
  const empty = !q.textAnswer || q.textAnswer.trim().length === 0
  if (empty) return "blank"
  return q.isCorrect === true ? "correct" : "wrong"
}

function QuestionRow({ q, displayNumber }: { q: ResultsQuestion; displayNumber: number }) {
  const status = deriveStatus(q)

  return (
    <li className="border-border bg-surface rounded-xl border p-5">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
            Pregunta {displayNumber}
          </p>
          <RichPrompt
            content={q.prompt}
            className="text-foreground mt-1 font-serif text-[16px]"
          />
        </div>
        <StatusPill status={status} />
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
                  {isCorrect && isSelected && <span className="text-teal-500">✓ Tu respuesta</span>}
                  {isCorrect && !isSelected && <span className="text-teal-500">Correcta</span>}
                  {!isCorrect && isSelected && <span className="text-danger">Tu respuesta</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {q.type === "FILL_IN" && (
        <div className="space-y-2">
          <div className="border-border bg-surface-alt rounded-md border px-3 py-2">
            <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
              Tu respuesta
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
                Respuesta correcta
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {q.acceptedAnswers.map((a, i) => (
                  <li
                    key={i}
                    className="inline-flex items-center gap-1 rounded-md border border-teal-500/40 bg-teal-500/[0.06] px-2 py-0.5 font-mono text-[12px] text-teal-500"
                  >
                    {a.answer}
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

function ResultErrorCard({ reason }: { reason: "not_found" | "expired" | "not_reviewed" }) {
  const copy: Record<typeof reason, { title: string; body: string }> = {
    not_found: {
      title: "No encontramos tu evaluación",
      body: "El enlace puede estar mal copiado. Revisa el correo que te enviamos o pídele a coordinación que te lo reenvíe.",
    },
    expired: {
      title: "El enlace ya venció",
      body: "Por seguridad, el enlace al resultado se mantiene disponible por unas horas. Escríbele a coordinación y te ayudamos a verlo de nuevo.",
    },
    not_reviewed: {
      title: "Todavía no está listo",
      body: "Tu evaluación aún se está revisando. Te enviaremos un correo cuando esté lista.",
    },
  }
  const { title, body } = copy[reason]

  return (
    <main className="bg-background flex min-h-screen flex-col px-4 py-10">
      <header className="mb-10 flex items-center justify-center gap-3">
        <BrandMark className="text-foreground" size={28} />
        <BrandWordmark className="text-foreground" size="md" />
      </header>
      <div className="mx-auto w-full max-w-[440px] flex-1">
        <div className="border-border bg-surface rounded-xl border px-8 py-9">
          <h1 className="text-foreground font-serif text-[24px] leading-[1.2] font-normal tracking-[-0.02em]">
            {title}
          </h1>
          <p className="text-text-2 mt-3 text-[13.5px] leading-[1.6]">{body}</p>
        </div>
      </div>
    </main>
  )
}
