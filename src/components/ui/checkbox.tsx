import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Checkbox — design-mockups/Widgets.html:742-761.
 *
 * Box 16×16, border-strong 1px, radius 4px. Checked: bg + border teal,
 * check icon white interno.
 *
 * Patrón: input nativo (peer, oculto absolute) + box visual (peer-checked) +
 * check icon (peer-checked). Todos siblings dentro del wrapper para que la
 * cascada `peer-checked:` funcione sin `:has()`.
 */

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <span className="relative inline-block h-4 w-4 shrink-0">
      <input
        ref={ref}
        type="checkbox"
        className={cn("peer absolute inset-0 h-full w-full cursor-pointer opacity-0", className)}
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          "border-border-strong bg-surface absolute inset-0 grid place-items-center rounded-sm border transition-colors duration-[150ms]",
          "peer-checked:border-teal-500 peer-checked:bg-teal-500",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500/40",
        )}
      />
      <Check
        aria-hidden
        size={9}
        strokeWidth={3}
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100"
      />
    </span>
  ),
)
Checkbox.displayName = "Checkbox"

/**
 * Variante radio circular — mismo patrón pero con dot interno.
 */
export type RadioProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, ...props }, ref) => (
    <span className="relative inline-block h-4 w-4 shrink-0">
      <input
        ref={ref}
        type="radio"
        className={cn("peer absolute inset-0 h-full w-full cursor-pointer opacity-0", className)}
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          "border-border-strong bg-surface absolute inset-0 rounded-full border transition-colors duration-[150ms]",
          "peer-checked:border-teal-500 peer-checked:bg-teal-500",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500/40",
        )}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 transition-opacity peer-checked:opacity-100"
      />
    </span>
  ),
)
Radio.displayName = "Radio"

/**
 * Wrapper del label + control que reproduce el patrón `.check` del mockup
 * (gap 9px, font 13.5px). El click en el texto activa el control.
 */
export function CheckLabel({
  children,
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-foreground inline-flex cursor-pointer items-center gap-2.5 text-[13.5px]",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  )
}
