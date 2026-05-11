import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Paginación — design-mockups/Widgets.html:894-903.
 *
 * Buttons 32px min-width, padding 6×10, mono 12.5px, radius 6px. Activa:
 * bg ink-900 (light) / bone (dark), border invertido.
 *
 * Patrón compound: Pagination + PaginationItem. PaginationEllipsis opcional.
 */

export type PaginationProps = React.HTMLAttributes<HTMLElement>

export function Pagination({ className, children, ...props }: PaginationProps) {
  return (
    <nav aria-label="Paginación" className={cn("inline-flex gap-1", className)} {...props}>
      {children}
    </nav>
  )
}

export type PaginationItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isCurrent?: boolean
}

export const PaginationItem = React.forwardRef<HTMLButtonElement, PaginationItemProps>(
  ({ className, isCurrent, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        "border-border text-text-2 inline-flex min-w-8 items-center justify-center rounded-md border px-2.5 py-1.5 font-mono text-[12.5px] transition-colors duration-[150ms]",
        "hover:border-text-3 hover:text-foreground",
        isCurrent &&
          "border-ink-900 bg-ink-900 text-bone hover:border-ink-900 hover:text-bone dark:border-bone dark:bg-bone dark:text-ink-900 dark:hover:text-ink-900",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
)
PaginationItem.displayName = "PaginationItem"

export function PaginationPrev(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <PaginationItem aria-label="Anterior" title="Anterior" {...props}>
      <ChevronLeft size={13} strokeWidth={1.6} />
    </PaginationItem>
  )
}

export function PaginationNext(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <PaginationItem aria-label="Siguiente" title="Siguiente" {...props}>
      <ChevronRight size={13} strokeWidth={1.6} />
    </PaginationItem>
  )
}

export function PaginationEllipsis() {
  return (
    <span
      aria-hidden
      className="text-text-3 inline-flex min-w-8 items-center justify-center font-mono text-[12.5px]"
    >
      …
    </span>
  )
}
