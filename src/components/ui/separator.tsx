import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Divisor 1px — design-mockups/Widgets.html:1295-1300.
 *
 * Variante:
 *   - solid (default) entre secciones jerárquicas
 *   - dashed para subdivisión visual dentro de un bloque
 */
export type SeparatorProps = React.HTMLAttributes<HTMLHRElement> & {
  variant?: "solid" | "dashed"
}

export const Separator = React.forwardRef<HTMLHRElement, SeparatorProps>(
  ({ className, variant = "solid", ...props }, ref) => (
    <hr
      ref={ref}
      className={cn(
        "border-border m-0 border-0 border-t",
        variant === "dashed" && "border-dashed",
        className,
      )}
      {...props}
    />
  ),
)
Separator.displayName = "Separator"
