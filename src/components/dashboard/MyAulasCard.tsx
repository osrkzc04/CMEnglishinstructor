import Link from "next/link"
import type { Route } from "next"
import { ArrowRight, Users } from "lucide-react"
import { Card, CardHeader, CardTitle, CardMeta } from "@/components/ui/card"
import { ProgressBar } from "@/components/ui/progress-bar"
import { cn } from "@/lib/utils"

/**
 * "Mis aulas" para el dashboard del docente. Espejo visual de
 * `TeacherLoadCard` admin pero con una fila por aula vigente.
 *
 * Cada fila: tile con iniciales del aula · nombre + programa · barra de
 * avance promedio del grupo · horas (consumidas / totales).
 */

export type MyAulaRow = {
  id: string
  name: string
  programLabel: string
  studentCount: number
  consumedHours: number
  totalHours: number
}

export function MyAulasCard({ items }: { items: MyAulaRow[] }) {
  const totalAulas = items.length
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis aulas</CardTitle>
        <CardMeta>
          {totalAulas} {totalAulas === 1 ? "aula vigente" : "aulas vigentes"}
        </CardMeta>
        <Link
          href={"/docente/aulas" as Route}
          className="inline-flex items-center gap-1.5 border-b border-border-strong pb-px text-[13px] text-text-2 transition-colors hover:border-teal-500 hover:text-teal-500"
        >
          Ver todas
          <ArrowRight size={11} strokeWidth={1.6} />
        </Link>
      </CardHeader>
      <div>
        {items.length === 0 ? (
          <p className="px-[22px] py-6 text-[13.5px] text-text-3">
            Cuando coordinación te asigne aulas vas a verlas acá con su avance.
          </p>
        ) : (
          items.map((a) => <AulaRow key={a.id} item={a} />)
        )}
      </div>
    </Card>
  )
}

function AulaRow({ item }: { item: MyAulaRow }) {
  const pct = item.totalHours > 0
    ? Math.min(100, Math.round((item.consumedHours / item.totalHours) * 100))
    : 0
  const variant: "info" | "default" | "warn" = pct >= 90 ? "warn" : pct < 25 ? "info" : "default"

  return (
    <Link
      href={`/docente/aulas/${item.id}` as Route}
      className="group grid grid-cols-[36px_1fr_auto_auto] items-center gap-3.5 border-b border-border px-[22px] py-3.5 transition-colors duration-[120ms] last:border-b-0 hover:bg-surface-alt"
    >
      <div
        className={cn(
          "grid h-8 w-8 place-items-center rounded-md border bg-bone-50 font-mono text-[11.5px] tracking-[0.02em] text-text-2",
          "border-border group-hover:border-teal-500",
        )}
      >
        {initials(item.name)}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[14px] leading-[1.3] text-foreground">
          {item.name}
        </div>
        <div className="mt-0.5 flex items-center gap-2 font-mono text-[12px] tracking-[0.02em] text-text-3">
          <span className="truncate">{item.programLabel}</span>
          <span aria-hidden className="inline-block h-[3px] w-[3px] rounded-full bg-text-4" />
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Users size={11} strokeWidth={1.6} />
            {item.studentCount}
          </span>
        </div>
      </div>
      <div className="w-20">
        <ProgressBar value={pct} variant={variant} bordered />
      </div>
      <div className="min-w-[90px] text-right font-mono text-[12px] leading-[1.3] text-foreground tabular-nums">
        {item.consumedHours.toFixed(1)}{" "}
        <span className="text-text-3">/ {item.totalHours}</span>
        <div className="mt-0.5 text-[11px] text-text-3">hrs grupo</div>
      </div>
    </Link>
  )
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "—"
  if (parts.length === 1) {
    return (parts[0]?.slice(0, 2) ?? "").toUpperCase()
  }
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}
