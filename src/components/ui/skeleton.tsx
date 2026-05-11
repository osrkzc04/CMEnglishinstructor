import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Skeleton — design-mockups/Widgets.html:928-934.
 *
 * Linear gradient móvil sobre surface-alt → bg → surface-alt, animación
 * shimmer 1.4s. Default 12px alto + radius 4px.
 */
export const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("skel-bg animate-shimmer h-3 rounded-sm", className)} {...props} />
  ),
)
Skeleton.displayName = "Skeleton"
