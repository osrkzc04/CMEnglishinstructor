import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Badge — design-mockups/Widgets.html:798-810.
 *
 * Mono 11px, padding 3×8, radius 4px, border 1px. Variantes:
 *  - default  → border ink-100, color text-2
 *  - solid    → bg ink-900, color bone (full contrast)
 *  - teal     → tinted teal vía color-mix
 *  - warning  → tinted warning
 *  - danger   → tinted danger
 *  - info     → tinted info
 *
 * Si pasás un dot (`<BadgeDot />`) como primer hijo, lo coloreás del color
 * del badge (currentColor).
 */

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border font-mono text-[11px] leading-[1.5] px-2 py-[3px]",
  {
    variants: {
      variant: {
        default: "border-border text-text-2",
        solid:   "border-ink-900 bg-ink-900 text-bone dark:border-bone dark:bg-bone dark:text-ink-900",
        teal:    "border-teal-500/35 bg-teal-500/[0.08] text-teal-500",
        warning: "border-warning/35 bg-warning/[0.08] text-warning",
        danger:  "border-danger/35 bg-danger/[0.08] text-danger",
        info:    "border-info/35 bg-info/[0.08] text-info",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  ),
)
Badge.displayName = "Badge"

/**
 * Dot indicator que vive dentro de un Badge tinted. 5×5 currentColor.
 */
export function BadgeDot() {
  return (
    <span
      aria-hidden
      className="inline-block h-[5px] w-[5px] rounded-full bg-current"
    />
  )
}
