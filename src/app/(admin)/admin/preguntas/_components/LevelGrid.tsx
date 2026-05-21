import Link from "next/link"
import type { Route } from "next"
import { AlertTriangle, ArrowRight, Check, X as CrossIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LevelOverviewItem } from "@/modules/questions/queries"

/**
 * Grid de la landing del banco de preguntas — una tarjeta por nivel CEFR
 * con su salud (cuántas activas vs. umbral), última edición y un CTA para
 * entrar al detalle.
 *
 * Tres estados visuales:
 *  - ok       → activeCount ≥ recommendedMin. Verde discreto.
 *  - low      → 1 ≤ activeCount < recommendedMin. Warning.
 *  - empty    → activeCount === 0. Danger (sin banco para sortear).
 */

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Guayaquil",
})

export function LevelGrid({
  levels,
  languageId,
}: {
  levels: LevelOverviewItem[]
  languageId: string
}) {
  if (levels.length === 0) {
    return (
      <div className="border-warning/40 bg-warning/[0.06] rounded-xl border px-5 py-4">
        <p className="text-foreground text-[14px] font-medium">
          No hay niveles CEFR configurados para este idioma
        </p>
        <p className="text-text-3 mt-1 text-[13px] leading-[1.55]">
          Coordinación necesita registrar los niveles antes de cargar preguntas.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {levels.map((level) => (
        <LevelCard key={level.levelId} level={level} languageId={languageId} />
      ))}
    </div>
  )
}

function LevelCard({ level, languageId }: { level: LevelOverviewItem; languageId: string }) {
  const state: "ok" | "low" | "empty" =
    level.activeCount === 0 ? "empty" : level.meetsThreshold ? "ok" : "low"

  const tone =
    state === "ok"
      ? "border-teal-500/30 bg-teal-500/[0.03]"
      : state === "low"
        ? "border-warning/30 bg-warning/[0.04]"
        : "border-danger/30 bg-danger/[0.04]"

  const href = `/admin/preguntas/${level.code.toLowerCase()}?languageId=${languageId}` as Route

  return (
    <article
      className={cn(
        "group border-border bg-surface flex flex-col gap-4 rounded-xl border p-5 transition-colors",
        tone,
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
            Nivel CEFR
          </p>
          <h2 className="text-foreground mt-1 font-serif text-[28px] leading-[1.1] font-normal tracking-[-0.015em]">
            {level.code}
          </h2>
          <p className="text-text-3 mt-0.5 text-[12.5px]">{level.name}</p>
        </div>
        <StateIcon state={state} />
      </header>

      <div className="space-y-1">
        <p className="font-serif text-[24px] leading-[1.1] tracking-[-0.01em]">
          <span
            className={cn(
              "tabular-nums",
              state === "ok" ? "text-teal-500" : state === "low" ? "text-warning" : "text-danger",
            )}
          >
            {level.activeCount}
          </span>
          <span className="text-text-3 text-[14px]"> / {level.recommendedMin} activas</span>
        </p>
        <p className="text-text-3 text-[12px] leading-[1.4]">
          {state === "empty"
            ? "Sin preguntas — el placement no puede sortear este nivel."
            : state === "low"
              ? `Faltan ${level.recommendedMin - level.activeCount} para el umbral.`
              : "Listo para sortear."}
          {level.inactiveCount > 0 && (
            <span className="text-text-4">
              {" · "}
              {level.inactiveCount} archivadas
            </span>
          )}
        </p>
      </div>

      <footer className="border-border mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <p className="text-text-3 font-mono text-[11px] tracking-[0.02em]">
          {level.lastEditedAt
            ? `Última edición: ${dateFormatter.format(level.lastEditedAt).replace(/\./g, "")}`
            : "Aún sin ediciones"}
        </p>
        <Link
          href={href}
          className="text-foreground inline-flex items-center gap-1 text-[12.5px] font-medium transition-colors hover:text-teal-500"
        >
          Administrar
          <ArrowRight size={12} strokeWidth={1.8} />
        </Link>
      </footer>
    </article>
  )
}

function StateIcon({ state }: { state: "ok" | "low" | "empty" }) {
  if (state === "ok") {
    return (
      <span
        className="inline-grid h-7 w-7 place-items-center rounded-full bg-teal-500/15 text-teal-500"
        aria-label="Banco completo"
      >
        <Check size={14} strokeWidth={2} />
      </span>
    )
  }
  if (state === "low") {
    return (
      <span
        className="bg-warning/15 text-warning inline-grid h-7 w-7 place-items-center rounded-full"
        aria-label="Banco bajo"
      >
        <AlertTriangle size={14} strokeWidth={2} />
      </span>
    )
  }
  return (
    <span
      className="bg-danger/15 text-danger inline-grid h-7 w-7 place-items-center rounded-full"
      aria-label="Banco vacío"
    >
      <CrossIcon size={14} strokeWidth={2} />
    </span>
  )
}
