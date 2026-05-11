import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Tabla editorial — design-mockups/Widgets.html:865-874.
 *
 * Header en mono caps tracking 0.08em sobre surface-alt. TD padding 12×16,
 * border-bottom 1px. Hover de fila: bg surface-alt. Última fila sin border.
 *
 * Numéricos: agregar `font-mono tabular-nums` al td (Tailwind ya lo soporta).
 */

export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <table ref={ref} className={cn("w-full border-collapse text-[13.5px]", className)} {...props} />
))
Table.displayName = "Table"

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <thead ref={ref} className={cn(className)} {...props} />)
TableHeader.displayName = "TableHeader"

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child_td]:border-b-0", className)} {...props} />
))
TableBody.displayName = "TableBody"

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn("hover:[&>td]:bg-surface-alt transition-colors", className)}
    {...props}
  />
))
TableRow.displayName = "TableRow"

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "border-border bg-surface-alt text-text-3 border-b px-4 py-3 text-left font-mono text-[11px] font-normal tracking-[0.08em] uppercase",
      className,
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("border-border text-foreground border-b px-4 py-3", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"
