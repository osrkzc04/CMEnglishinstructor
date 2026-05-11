import type { LucideIcon } from "lucide-react"
import { ChevronUp, ChevronDown, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * KPI band — design-mockups/Dashboard.html:452-497.
 *
 * Grid de 4 (o N) celdas dentro de un único contenedor con borde 1px y
 * radius 12px. Las celdas se separan con border-right (no gap). Cada celda:
 *  - .k     mono caps 12px tracking 0.08em + icon 13px
 *  - .v     Fraunces 38px tnum, opcional unit en text-3 16px
 *  - .delta mono 12px, variant up/down/warn/default
 */

export type Delta = {
  text: string
  variant?: "up" | "down" | "warn" | "default"
}

export type Kpi = {
  label: string
  value: string
  unit?: string
  icon: LucideIcon
  delta?: Delta
}

export function KpiBand({ items }: { items: Kpi[] }) {
  return (
    <section
      className={cn(
        "border-border bg-surface mb-7 grid overflow-hidden rounded-2xl border",
        "grid-cols-2 lg:grid-cols-4",
        // Las celdas en mobile se separan con border-bottom + border-right
        "[&>*]:border-border [&>*]:border-r",
        "lg:[&>*:last-child]:border-r-0",
        "[&>*:nth-child(2)]:border-r-0 lg:[&>*:nth-child(2)]:border-r",
        "[&>*:nth-child(-n+2)]:border-b lg:[&>*:nth-child(-n+2)]:border-b-0",
      )}
    >
      {items.map((kpi) => (
        <KpiCell key={kpi.label} kpi={kpi} />
      ))}
    </section>
  )
}

function KpiCell({ kpi }: { kpi: Kpi }) {
  const Icon = kpi.icon
  return (
    <div className="relative flex flex-col gap-1.5 px-6 py-5">
      <div className="text-text-3 flex items-center gap-2 font-mono text-[12px] tracking-[0.08em] uppercase">
        <Icon size={13} strokeWidth={1.6} className="text-text-4" />
        {kpi.label}
      </div>
      <div className="text-foreground mt-0.5 flex items-baseline gap-2 font-serif text-[38px] leading-[1.05] font-normal tracking-[-0.025em] tabular-nums">
        {kpi.value}
        {kpi.unit && (
          <span className="text-text-3 font-mono text-[16px] tracking-normal">{kpi.unit}</span>
        )}
      </div>
      {kpi.delta && <DeltaLine delta={kpi.delta} />}
    </div>
  )
}

function DeltaLine({ delta }: { delta: Delta }) {
  const variant = delta.variant ?? "default"
  const Icon =
    variant === "up"
      ? ChevronUp
      : variant === "down"
        ? ChevronDown
        : variant === "warn"
          ? AlertCircle
          : null
  return (
    <div
      className={cn(
        "mt-0.5 flex items-center gap-1.5 font-mono text-[12px]",
        variant === "up" && "text-teal-500",
        variant === "down" && "text-danger",
        variant === "warn" && "text-warning",
        variant === "default" && "text-text-3",
      )}
    >
      {Icon && <Icon size={12} strokeWidth={2} />}
      {delta.text}
    </div>
  )
}
