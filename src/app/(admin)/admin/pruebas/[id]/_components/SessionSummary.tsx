import { Check, Clock, ShieldAlert, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ReviewDetail, ReviewSectionSummary } from "@/modules/tests/sessions/review-queries"

/**
 * Panel superior con los datos del candidato y el resumen automático: status
 * de la sesión, puntaje auto, % por bloque CEFR y un indicador de eventos
 * sospechosos. NO toma decisiones — solo expone lo que el motor calculó.
 */

const STATUS_BADGE: Record<
  ReviewDetail["session"]["status"],
  { label: string; variant: "default" | "teal" | "warning" | "info" | "danger" }
> = {
  IN_PROGRESS: { label: "En curso", variant: "teal" },
  SUBMITTED: { label: "Por revisar", variant: "warning" },
  TIMED_OUT: { label: "Por revisar · tiempo", variant: "warning" },
  REVIEWED: { label: "Revisada", variant: "teal" },
  ABANDONED: { label: "Abandonada", variant: "default" },
}

type Props = {
  detail: ReviewDetail
  eventsCount: number
  suspiciousCount: number
}

export function SessionSummary({ detail, eventsCount, suspiciousCount }: Props) {
  const { session, sectionSummaries } = detail
  const badge = STATUS_BADGE[session.status]
  const durationMinutes = session.submittedAt
    ? Math.max(
        0,
        Math.round((session.submittedAt.getTime() - session.startedAt.getTime()) / 60_000),
      )
    : null

  return (
    <section className="border-border bg-surface space-y-5 rounded-xl border p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">Candidato</p>
          <h2 className="text-foreground mt-1 font-serif text-[24px] leading-[1.2] font-normal tracking-[-0.015em]">
            {session.candidateName}
          </h2>
          <p className="text-text-3 mt-1 text-[13.5px]">{session.candidateEmail}</p>
          {(session.candidatePhone || session.candidateDocument) && (
            <p className="text-text-3 mt-0.5 font-mono text-[12px] tracking-[0.02em]">
              {session.candidatePhone && <span>{session.candidatePhone}</span>}
              {session.candidatePhone && session.candidateDocument && <span> · </span>}
              {session.candidateDocument && <span>{session.candidateDocument}</span>}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <p className="text-text-3 font-mono text-[11.5px] tracking-[0.02em]">
            {session.template.name}
          </p>
        </div>
      </div>

      <div className="border-border grid gap-4 border-t pt-5 sm:grid-cols-4">
        <Stat
          icon={<Clock size={14} strokeWidth={1.6} />}
          label="Tiempo permitido"
          value={`${session.template.timeLimitMinutes} min`}
        />
        <Stat
          icon={<Clock size={14} strokeWidth={1.6} />}
          label="Tiempo usado"
          value={durationMinutes !== null ? `${durationMinutes} min` : "—"}
        />
        <Stat
          icon={<Check size={14} strokeWidth={1.6} />}
          label="Auto-score"
          value={
            session.autoScore !== null && session.maxAutoScore !== null
              ? `${session.autoScore} / ${session.maxAutoScore}`
              : "—"
          }
        />
        <Stat
          icon={<ShieldAlert size={14} strokeWidth={1.6} />}
          label="Eventos / sospechosos"
          value={`${eventsCount} / ${suspiciousCount}`}
          accent={suspiciousCount > 0 ? "warning" : "default"}
        />
      </div>

      {sectionSummaries.length > 0 && (
        <div className="border-border space-y-2 border-t pt-5">
          <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
            Avance por bloque
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sectionSummaries.map((s) => (
              <SectionRow key={s.sectionOrder} section={s} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: "default" | "warning"
}) {
  return (
    <div>
      <p className="text-text-3 mb-1 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] uppercase">
        <span aria-hidden>{icon}</span>
        {label}
      </p>
      <p
        className={cn(
          "font-mono text-[16px] tabular-nums",
          accent === "warning" ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  )
}

function SectionRow({ section }: { section: ReviewSectionSummary }) {
  const cleared = section.passedThreshold
  return (
    <li className="border-border bg-surface-alt rounded-md border px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-foreground text-[13px] font-medium">Bloque {section.sectionOrder}</p>
          <p className="text-text-3 font-mono text-[11px] tracking-[0.02em]">
            {section.cefrLevelCode} · umbral {section.passingPercent}%
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[12px] tabular-nums",
            cleared
              ? "border-teal-500/40 bg-teal-500/[0.08] text-teal-500"
              : "border-border bg-surface text-text-3",
          )}
        >
          {cleared ? <Check size={11} strokeWidth={1.8} /> : <X size={11} strokeWidth={1.8} />}
          {section.correctAnswers}/{section.totalQuestions}
          <span className="text-text-4 ml-1">· {section.scorePercent}%</span>
        </span>
      </div>
    </li>
  )
}
