import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Empty state — design-mockups/Widgets.html:936-953.
 *
 * Centrado vertical con padding 48×24, border 1px **dashed** border-strong,
 * radius 12px, bg surface. Ico round 48×48 surface-alt. Title en Fraunces
 * italic 18px (la voz editorial). Description text-2 13.5px. Acción opcional
 * abajo (típicamente un botón ghost).
 */

export type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  /** Si true, no muestra el border dashed exterior (útil cuando ya estás
   *  dentro de una Card que provee su propio borde). */
  bare?: boolean
}

export function EmptyState({
  className,
  icon: Icon,
  title,
  description,
  action,
  bare,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        bare
          ? "px-4 py-10"
          : "rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-12",
        className,
      )}
      {...props}
    >
      {Icon && (
        <div className="mb-3.5 grid h-12 w-12 place-items-center rounded-full border border-border bg-surface-alt text-text-3">
          <Icon size={20} strokeWidth={1.6} />
        </div>
      )}
      <h4 className="m-0 font-serif text-[18px] font-light italic tracking-[-0.01em] text-foreground">
        {title}
      </h4>
      {description && (
        <p className="m-0 mt-1 max-w-[420px] text-[13.5px] text-text-2">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
