import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Botones — replica design-mockups/Widgets.html:690-715.
 *
 * Variantes:
 *  - primary  → bg ink-900 (form-grade), hover SALTA a teal. La firma de marca.
 *  - teal     → bg teal sólido, hover teal-700. Para CTAs en headers/toolbars.
 *  - ghost    → outline, hover border + color teal.
 *  - link     → solo border-bottom, sin bg.
 *  - danger   → outline rojo terracota, hover sólido.
 *
 * Sizes:
 *  - sm  → 6×10 / 12px
 *  - md  → 9×14 / 13.5px (default)
 *  - lg  → 12×18 / 14.5px
 *  - icon → 8×8 cuadrado
 */
const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent font-medium leading-none",
    "transition-[background-color,color,border-color] duration-[120ms] ease-out",
    "disabled:opacity-40 disabled:pointer-events-none",
    "focus-visible:outline-none",
  ),
  {
    variants: {
      variant: {
        primary:
          "bg-ink-900 text-bone border-ink-900 hover:bg-teal-500 hover:border-teal-500 dark:bg-bone dark:text-ink-900 dark:border-bone dark:hover:bg-teal-500 dark:hover:text-bone dark:hover:border-teal-500",
        teal: "bg-teal-500 text-bone border-teal-500 hover:bg-teal-700 hover:border-teal-700",
        ghost: "bg-surface text-foreground border-border hover:border-teal-500 hover:text-teal-500",
        link: "rounded-none bg-transparent text-foreground border-0 border-b border-border-strong px-1 py-2.5 hover:text-teal-500 hover:border-teal-500",
        danger:
          "bg-transparent text-danger border-danger/40 hover:bg-danger hover:text-bone hover:border-danger",
      },
      size: {
        sm: "px-2.5 py-1.5 text-[12px] [&_svg]:size-3",
        md: "px-3.5 py-2.5 text-[13.5px] [&_svg]:size-3.5",
        lg: "px-4.5 py-3 text-[14.5px] [&_svg]:size-4",
        icon: "p-2 [&_svg]:size-3.5",
      },
    },
    compoundVariants: [
      // El link ignora el padding default — usa el suyo
      { variant: "link", size: "sm", class: "px-1 py-1.5" },
      { variant: "link", size: "md", class: "px-1 py-2.5" },
      { variant: "link", size: "lg", class: "px-1 py-3" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    )
  },
)
Button.displayName = "Button"

export { buttonVariants }
