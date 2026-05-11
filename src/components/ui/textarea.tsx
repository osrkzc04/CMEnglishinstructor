import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Textarea — design-mockups/Widgets.html:739.
 * `min-height: 80px`, `resize: vertical`, `line-height: 1.5`. Hereda los
 * estilos del Input pero como elemento textarea.
 */
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "border-border bg-surface text-foreground placeholder:text-text-4 block w-full resize-y rounded-lg border px-3.5 py-3 text-[14px] leading-[1.5]",
        "min-h-[80px]",
        "transition-[border-color,background-color] duration-[150ms] ease-out",
        "hover:border-border-strong",
        "focus:border-teal-500 focus:outline-none",
        "disabled:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-60",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = "Textarea"
