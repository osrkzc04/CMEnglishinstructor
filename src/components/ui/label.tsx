"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cn } from "@/lib/utils"

/**
 * Label de input — design-mockups/Widgets.html:719-722.
 *
 * Mono, 11px, tracking 0.08em uppercase, text-3. La voz para nombrar campos
 * sin ruido visual.
 */
export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-text-3 block font-mono text-[11px] leading-none tracking-[0.08em] uppercase",
      "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
      className,
    )}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

/**
 * Hint inline a la derecha del label (ej. "¿Olvidaste tu contraseña?").
 * Texto regular Geist, sin uppercase ni tracking.
 */
export const LabelHint = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn("text-text-3 font-sans text-[12px] tracking-normal normal-case", className)}
      {...props}
    />
  ),
)
LabelHint.displayName = "LabelHint"
