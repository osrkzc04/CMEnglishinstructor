import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Card editorial — design-mockups/Dashboard.html:500-526.
 *
 * Estructura observada:
 *   .card                     surface, border 1px, radius 12px (rounded-2xl)
 *     .card-head              padding 18×22, border-bottom 1px
 *       h3 (Fraunces 20)      titular
 *       .meta (mono 12)       opcional, tracking 0.04em
 *       a.more (text-2 13.5)  opcional, border-bottom thin
 *     .body                   padding o list interno (definido por contenido)
 *
 * Sin shadow. Sin radius > 12. CardKicker es un eyebrow mono caps opcional
 * arriba del título — útil cuando el título es corto y el contexto necesita
 * jerarquía adicional.
 */

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border border-border bg-surface text-foreground",
      className,
    )}
    {...props}
  />
))
Card.displayName = "Card"

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-wrap items-center justify-between gap-3.5 border-b border-border px-[22px] py-[18px]",
      className,
    )}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

/**
 * Eyebrow mono caps opcional. En el mockup aparece como pequeño label arriba
 * del título cuando hay jerarquía editorial.
 */
export const CardKicker = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "font-mono text-[11px] uppercase tracking-[0.08em] text-text-3",
      className,
    )}
    {...props}
  />
))
CardKicker.displayName = "CardKicker"

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "m-0 font-serif text-[20px] font-normal leading-[1.2] tracking-[-0.015em] text-foreground",
      className,
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-[13.5px] text-text-2", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

/**
 * Meta secundario del card-head: ej. "12 clases · 4 docentes" en mono 12px
 * tracking 0.04em.
 */
export const CardMeta = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "font-mono text-[12px] tracking-[0.04em] text-text-3",
      className,
    )}
    {...props}
  />
))
CardMeta.displayName = "CardMeta"

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-[22px] py-5", className)} {...props} />
))
CardContent.displayName = "CardContent"

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center gap-3 border-t border-border px-[22px] py-4",
      className,
    )}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"
