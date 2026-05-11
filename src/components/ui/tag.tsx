import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Tag / chip — design-mockups/Widgets.html:812-819.
 *
 * Mono 11px, radius 4px, bg `--bg`, border 1px. Útil para filtros activos y
 * keywords. Si se pasa `onRemove`, muestra una x al final que dispara el
 * handler.
 */

export type TagProps = React.HTMLAttributes<HTMLSpanElement> & {
  onRemove?: () => void
}

export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(
  ({ className, children, onRemove, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-1.5 py-[3px] font-mono text-[11px] text-text-3",
        className,
      )}
      {...props}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar"
          className="ml-0.5 -mr-0.5 text-text-4 transition-colors hover:text-danger"
        >
          <X size={10} strokeWidth={1.6} />
        </button>
      )}
    </span>
  ),
)
Tag.displayName = "Tag"
