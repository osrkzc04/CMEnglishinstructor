import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Progress ring — design-mockups/Widgets.html:916-926.
 *
 * 56×56px, círculo con conic-gradient teal hasta el porcentaje. `::before`
 * interno (inset 6px) crea el hueco. Numérico Geist Mono 13px tnum centrado.
 * Útil cuando el espacio horizontal es escaso para barras.
 */
export type ProgressRingProps = React.HTMLAttributes<HTMLDivElement> & {
  value: number
  size?: number
  thickness?: number
}

export function ProgressRing({
  className,
  value,
  size = 56,
  thickness = 6,
  children,
  ...props
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const innerInset = thickness

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative grid place-items-center", className)}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(hsl(var(--ring)) ${clamped * 3.6}deg, hsl(var(--border)) 0)`,
        borderRadius: "50%",
      }}
      {...props}
    >
      <span
        aria-hidden
        className="absolute rounded-full bg-surface"
        style={{ inset: innerInset }}
      />
      <span className="relative font-mono text-[13px] tabular-nums text-foreground">
        {children ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  )
}
