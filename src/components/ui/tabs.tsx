"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

/**
 * Tabs — design-mockups/Widgets.html:877-886.
 *
 * Border-bottom 1px en la lista, indicator border-bottom 2px teal en el tab
 * activo (con margin-bottom -1px para superponerse al borde). Buttons padding
 * 10×16, font 13.5px, color text-3 default → text on hover/active.
 */

export const Tabs = TabsPrimitive.Root

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("border-border flex border-b", className)}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "text-text-3 -mb-px inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-[13.5px]",
      "transition-colors duration-[150ms]",
      "hover:text-foreground",
      "data-[state=active]:text-foreground data-[state=active]:border-teal-500",
      "focus-visible:outline-none",
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("pt-4", className)} {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName
