"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

/**
 * Switch — design-mockups/Widgets.html:764-781.
 *
 * Track 32×18, knob 14×14, ink-300 default → teal cuando activo. Knob blanco
 * con micro-shadow.
 */
export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer relative h-[18px] w-8 shrink-0 cursor-pointer rounded-full bg-ink-200 transition-colors",
      "data-[state=checked]:bg-teal-500",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "block h-3.5 w-3.5 translate-x-0.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition-transform",
        "data-[state=checked]:translate-x-[15px]",
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName
