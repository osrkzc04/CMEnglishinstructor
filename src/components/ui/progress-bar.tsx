import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Barra de progreso — design-mockups/Widgets.html:1001-1005 + Dashboard.html:694-707.
 *
 * Track 6px, bg `--bg`, border 1px (versión Dashboard) o sin border (versión
 * compacta de Widgets). Inner: bg semantic, radius 3-4px.
 *
 * Variantes:
 *  - default → teal
 *  - warn    → warning
 *  - danger  → danger
 *  - info    → info
 */

const fillVariants = cva("h-full rounded-sm transition-[width] duration-[200ms]", {
  variants: {
    variant: {
      default: "bg-teal-500",
      warn:    "bg-warning",
      danger:  "bg-danger",
      info:    "bg-info",
    },
  },
  defaultVariants: { variant: "default" },
})

export type ProgressBarProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof fillVariants> & {
    /** Valor 0-100 */
    value: number
    /** Si true, agrega border al track (estilo Dashboard). */
    bordered?: boolean
  }

export function ProgressBar({
  className,
  value,
  variant,
  bordered,
  ...props
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-sm bg-background",
        bordered && "border border-border",
        className,
      )}
      {...props}
    >
      <div
        className={cn(fillVariants({ variant }))}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
