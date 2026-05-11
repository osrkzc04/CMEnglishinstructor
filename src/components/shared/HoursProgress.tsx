import { ProgressBar } from "@/components/ui/progress-bar"
import { cn } from "@/lib/utils"

/**
 * Indicador "X / Y horas" con barra. Reusable en dashboards de estudiante,
 * docente y detalle admin.
 *
 * Convención de color:
 *   - default (teal) — progreso saludable (<= 90%)
 *   - info (azul)    — cerca del fin (90-100%)
 *   - warn (amarillo) — excedido (> 100%, sucede si hay horas extra)
 */

type Props = {
  consumed: number
  total: number
  /** Etiqueta superior (ej. "Mi avance" o el nombre del nivel). */
  label?: string
  /** Tamaño compacto si se pone en cards densos. */
  size?: "sm" | "md"
  className?: string
}

export function HoursProgress({
  consumed,
  total,
  label,
  size = "md",
  className,
}: Props) {
  const safeTotal = total > 0 ? total : 1
  const pct = (consumed / safeTotal) * 100
  const clampedPct = Math.min(100, Math.max(0, pct))
  const variant: "default" | "warn" | "info" =
    pct > 100 ? "warn" : pct >= 90 ? "info" : "default"

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-2 text-[12px]">
          <span className="text-text-3">{label}</span>
          <span className="font-mono text-text-2">
            {format(consumed)} / {format(total)} h
          </span>
        </div>
      )}
      <ProgressBar
        value={clampedPct}
        variant={variant}
        bordered={size === "md"}
        className={size === "sm" ? "h-1" : undefined}
      />
      {!label && (
        <div className="flex items-baseline justify-between text-[11.5px] text-text-3">
          <span>
            <span className="font-mono text-text-2">
              {format(consumed)}
            </span>{" "}
            de {format(total)} h
          </span>
          <span className="font-mono">{Math.round(clampedPct)}%</span>
        </div>
      )}
    </div>
  )
}

function format(n: number): string {
  // Sin decimales si es entero, 1 decimal si no.
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
