import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Tooltip bubble — design-mockups/Widgets.html:905-914.
 *
 * Bg ink-900, color bone, font 12px, padding 6×10, radius 6px. Pseudo flecha
 * cuadrada 8×8 rotada 45° en bottom-left. Estático: úsalo dentro de un
 * popover/floating-ui controller cuando necesites posicionamiento real.
 */
export const Tooltip = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      role="tooltip"
      className={cn(
        "bg-ink-900 text-bone relative inline-block rounded-md px-2.5 py-1.5 text-[12px]",
        "after:bg-ink-900 after:absolute after:bottom-[-4px] after:left-3.5 after:h-2 after:w-2 after:rotate-45 after:content-['']",
        "dark:bg-bone dark:text-ink-900 dark:after:bg-bone",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
)
Tooltip.displayName = "Tooltip"
