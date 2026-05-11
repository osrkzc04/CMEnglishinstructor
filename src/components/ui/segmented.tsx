"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Segmented control — design-mockups/Widgets.html:784-795.
 *
 * 2 a 4 opciones excluyentes. El segmento activo lleva bg ink-900 (light) o
 * bone (dark). Use cases: filtro Día/Semana/Mes, ES/EN, Light/Dark.
 *
 * Patrón compound:
 *   <Segmented value={value} onValueChange={setValue}>
 *     <SegmentedItem value="day">Día</SegmentedItem>
 *     <SegmentedItem value="week">Semana</SegmentedItem>
 *   </Segmented>
 */

type SegmentedContextValue = {
  value: string
  onValueChange: (value: string) => void
}

const SegmentedContext = React.createContext<SegmentedContextValue | null>(null)

export type SegmentedProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string
  onValueChange: (value: string) => void
  ariaLabel?: string
}

export function Segmented({
  value,
  onValueChange,
  ariaLabel,
  className,
  children,
  ...props
}: SegmentedProps) {
  return (
    <SegmentedContext.Provider value={{ value, onValueChange }}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center rounded-md border border-border bg-surface p-0.5",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </SegmentedContext.Provider>
  )
}

export type SegmentedItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string
}

export function SegmentedItem({
  value,
  className,
  children,
  ...props
}: SegmentedItemProps) {
  const ctx = React.useContext(SegmentedContext)
  if (!ctx) throw new Error("<SegmentedItem> debe vivir dentro de <Segmented>")
  const isActive = ctx.value === value

  return (
    <button
      type="button"
      role="tab"
      aria-pressed={isActive}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        "rounded-[5px] px-3 py-1.5 text-[12.5px] transition-colors duration-[150ms]",
        isActive
          ? "bg-ink-900 text-bone dark:bg-bone dark:text-ink-900"
          : "text-text-3 hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
