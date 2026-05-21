import Link from "next/link"
import type { Route } from "next"
import { AlertTriangle, Check, Plus, Upload, X as CrossIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LevelOverviewItem } from "@/modules/questions/queries"

/**
 * Header del nivel: badge grande del code (A1, B2, etc), nombre, conteo
 * activas/umbral con tono y CTAs:
 *  - "Importar" abre `/admin/preguntas/[code]/importar` (CSV con preview).
 *  - "Nueva pregunta" enlaza a `/admin/preguntas/[code]/nueva`.
 */

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "America/Guayaquil",
})

export function LevelHeader({ level }: { level: LevelOverviewItem }) {
  const state: "ok" | "low" | "empty" =
    level.activeCount === 0 ? "empty" : level.meetsThreshold ? "ok" : "low"

  return (
    <section className="border-border bg-surface mb-6 rounded-xl border p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "inline-grid h-16 w-16 flex-shrink-0 place-items-center rounded-xl border font-serif text-[28px] leading-none tracking-[-0.02em]",
              state === "ok"
                ? "border-teal-500/40 bg-teal-500/[0.08] text-teal-500"
                : state === "low"
                  ? "border-warning/40 bg-warning/[0.08] text-warning"
                  : "border-danger/40 bg-danger/[0.08] text-danger",
            )}
            aria-hidden
          >
            {level.code}
          </span>
          <div>
            <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
              Nivel CEFR
            </p>
            <h1 className="text-foreground mt-1 font-serif text-[26px] leading-[1.18] font-normal tracking-[-0.02em]">
              {level.name}
            </h1>
            <div className="text-text-2 mt-2 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="inline-flex items-center gap-1.5">
                <StateBadge state={state} />
                <span>
                  <strong className="text-foreground tabular-nums">{level.activeCount}</strong> /{" "}
                  {level.recommendedMin} preguntas activas
                </span>
              </span>
              {level.inactiveCount > 0 && (
                <span className="text-text-3">· {level.inactiveCount} archivadas</span>
              )}
              {level.lastEditedAt && (
                <span className="text-text-3">
                  · Última edición {dateFormatter.format(level.lastEditedAt)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/preguntas/${level.code.toLowerCase()}/importar` as Route}
            className="border-border bg-surface text-text-2 inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-[13px] font-medium transition-colors hover:border-teal-500 hover:text-teal-500"
          >
            <Upload size={13} strokeWidth={1.7} />
            Importar {level.code}
          </Link>
          <Link
            href={`/admin/preguntas/${level.code.toLowerCase()}/nueva` as Route}
            className="border-ink-900 bg-ink-900 text-bone dark:border-bone dark:bg-bone dark:text-ink-900 inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-[13px] font-medium transition-colors hover:border-teal-500 hover:bg-teal-500"
          >
            <Plus size={13} strokeWidth={1.7} />
            Nueva pregunta {level.code}
          </Link>
        </div>
      </div>
    </section>
  )
}

function StateBadge({ state }: { state: "ok" | "low" | "empty" }) {
  if (state === "ok") {
    return (
      <span
        className="inline-grid h-5 w-5 place-items-center rounded-full bg-teal-500/15 text-teal-500"
        aria-label="Banco completo"
      >
        <Check size={11} strokeWidth={2.2} />
      </span>
    )
  }
  if (state === "low") {
    return (
      <span
        className="bg-warning/15 text-warning inline-grid h-5 w-5 place-items-center rounded-full"
        aria-label="Banco bajo"
      >
        <AlertTriangle size={11} strokeWidth={2} />
      </span>
    )
  }
  return (
    <span
      className="bg-danger/15 text-danger inline-grid h-5 w-5 place-items-center rounded-full"
      aria-label="Banco vacío"
    >
      <CrossIcon size={11} strokeWidth={2} />
    </span>
  )
}
