import * as React from "react"
import { X } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Alert / Toast — design-mockups/Widgets.html:843-862.
 *
 * Estructura: ico (color por variante) + body (strong título + p desc) + close opcional.
 * Variantes:
 *  - default → surface bg, border default, ico text-3
 *  - teal    → tint teal 6%, border teal 25%, ico teal
 *  - warn    → tint warning
 *  - danger  → tint danger
 *  - info    → tint info
 */

const alertVariants = cva(
  "flex items-start gap-3 rounded-lg border p-3.5 text-[13.5px] leading-[1.5]",
  {
    variants: {
      variant: {
        default: "border-border bg-surface text-foreground [&_.alert-ico]:text-text-3",
        teal: "border-teal-500/25 bg-teal-500/[0.06] text-foreground [&_.alert-ico]:text-teal-500",
        warn: "border-warning/25 bg-warning/[0.06] text-foreground [&_.alert-ico]:text-warning",
        danger: "border-danger/30 bg-danger/[0.06] text-foreground [&_.alert-ico]:text-danger",
        info: "border-info/25 bg-info/[0.06] text-foreground [&_.alert-ico]:text-info",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

export type AlertProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants> & {
    icon?: React.ReactNode
    title?: React.ReactNode
    description?: React.ReactNode
    onDismiss?: () => void
  }

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, icon, title, description, onDismiss, children, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {icon && (
        <span aria-hidden className="alert-ico mt-px shrink-0 [&>svg]:size-4">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {title && <strong className="text-foreground block font-medium">{title}</strong>}
        {description && <p className="text-text-2 m-0 text-[13px]">{description}</p>}
        {children}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Descartar"
          className="text-text-4 hover:text-foreground shrink-0 p-0.5 transition-colors"
        >
          <X size={14} strokeWidth={1.6} />
        </button>
      )}
    </div>
  ),
)
Alert.displayName = "Alert"
