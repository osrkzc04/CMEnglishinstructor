import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Select nativo estilizado — design-mockups/Widgets.html:1407-1410 usa el
 * `<select>` HTML directamente con la clase `.input`. Mantenemos esa decisión:
 * select nativo con la misma estética que Input + chevron decorativo.
 *
 * Para casos avanzados (búsqueda, multi-select, render custom de items) usar
 * el primitive Radix Select por separado.
 */
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(
          "border-border bg-surface text-foreground block w-full appearance-none rounded-lg border px-3.5 py-3 pr-10 text-[14px] leading-[1.4]",
          "transition-[border-color,background-color] duration-[150ms] ease-out",
          "hover:border-border-strong",
          "focus:border-teal-500 focus:outline-none",
          "disabled:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <span
        aria-hidden
        className="text-text-3 pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
      >
        <ChevronDown size={14} strokeWidth={1.6} />
      </span>
    </div>
  ),
)
Select.displayName = "Select"
