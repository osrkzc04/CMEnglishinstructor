import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Avatar — design-mockups/Widgets.html:822-840.
 *
 * Iniciales en Geist Mono. Variantes:
 *  - sm   → 24×24, font 10px
 *  - md   → 36×36, font 12px (default)
 *  - lg   → 56×56, font 16px
 *  - shape: round (default) | square (radius 7px)
 *
 * `<AvatarStack>` apila avatares con margen negativo y ring 2px del surface
 * para separarlos. El último puede ser un "+N" en ink-900 sólido.
 */

const avatarVariants = cva(
  "inline-grid place-items-center shrink-0 border border-border bg-surface-alt font-mono text-text-2",
  {
    variants: {
      size: {
        sm: "h-6 w-6 text-[10px]",
        md: "h-9 w-9 text-[12px]",
        lg: "h-14 w-14 text-[16px]",
      },
      shape: {
        round: "rounded-full",
        square: "rounded-md",
      },
    },
    defaultVariants: {
      size: "md",
      shape: "round",
    },
  },
)

export type AvatarProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof avatarVariants> & {
    initials: string
    /** Si true, muestra un dot teal status abajo-derecha (solo round). */
    status?: boolean
  }

export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, size, shape, initials, status, ...props }, ref) => (
    <span ref={ref} className={cn("relative inline-block", className)} {...props}>
      <span className={cn(avatarVariants({ size, shape }))}>{initials}</span>
      {status && shape !== "square" && (
        <span
          aria-hidden
          className="ring-surface absolute right-0 bottom-0 h-[9px] w-[9px] rounded-full bg-teal-500 ring-[2px]"
        />
      )}
    </span>
  ),
)
Avatar.displayName = "Avatar"

export function AvatarStack({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "[&>span]:ring-surface inline-flex [&>span]:ring-2 [&>span:not(:first-child)]:-ml-2",
        className,
      )}
    >
      {children}
    </div>
  )
}
