import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Input editorial — design-mockups/Widgets.html:723-739, Login.html:290-323.
 *
 * Surface bg, border 1px, radius 8px, padding 12×14. Hover sube a border-strong.
 * Focus: border teal + ring custom (definido global en :focus-visible).
 *
 * Si se pasa `icon`, padding-left aumenta para acomodar el icono absolute.
 * Si se pasa `endAdornment` (e.g. botón mostrar/ocultar contraseña), padding-right.
 *
 * Para wrappers más complejos (con iconos en ambos extremos), usar InputWrap +
 * Input directamente.
 */

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: LucideIcon
  endAdornment?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", icon: Icon, endAdornment, ...props }, ref) => {
    const hasIcon = !!Icon
    const hasAction = !!endAdornment

    if (!hasIcon && !hasAction) {
      return (
        <input
          ref={ref}
          type={type}
          className={cn(inputBaseClasses, className)}
          {...props}
        />
      )
    }

    return (
      <div className="relative w-full">
        {hasIcon && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-text-4"
          >
            <Icon size={15} strokeWidth={1.6} />
          </span>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            inputBaseClasses,
            hasIcon && "pl-[38px]",
            hasAction && "pr-10",
            className,
          )}
          {...props}
        />
        {hasAction && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {endAdornment}
          </div>
        )}
      </div>
    )
  },
)
Input.displayName = "Input"

const inputBaseClasses = cn(
  "block w-full rounded-lg border border-border bg-surface px-3.5 py-3 text-[14px] leading-[1.4] text-foreground placeholder:text-text-4",
  "transition-[border-color,background-color] duration-[150ms] ease-out",
  "hover:border-border-strong",
  "focus:outline-none focus:border-teal-500",
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-surface-alt",
  "aria-[invalid=true]:border-danger",
)

/**
 * Acción accesoria dentro del input (botón mostrar contraseña, clear, etc.).
 * Padding y estilo coherente con el slot endAdornment.
 */
export const InputAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "rounded-md p-1.5 text-text-3 transition-colors hover:text-foreground",
      className,
    )}
    {...props}
  />
))
InputAction.displayName = "InputAction"
