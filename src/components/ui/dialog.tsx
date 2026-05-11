"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Dialog editorial — replica el lenguaje del mockup. Overlay ink-900/55,
 * panel `surface` con borde 1px y radius 12px. Sin sombras dramáticas. El
 * `aria-describedby` queda libre — se setea en el contenido si hay
 * description.
 */

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal
export const DialogClose = DialogPrimitive.Close

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-ink-900/55 backdrop-blur-[2px]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

type DialogContentProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> & {
  /** Tamaño del panel — controla `max-width`. Default `md`. */
  size?: "sm" | "md" | "lg"
  /** Oculta la X de cerrar. */
  hideClose?: boolean
}

const SIZE_CLASS: Record<NonNullable<DialogContentProps["size"]>, string> = {
  sm: "max-w-[420px]",
  md: "max-w-[640px]",
  lg: "max-w-[820px]",
}

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, size = "md", hideClose, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 flex w-full -translate-x-1/2 -translate-y-1/2 flex-col",
        "max-h-[calc(100vh-48px)] overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-[0_24px_60px_-30px_rgba(35,54,65,0.45)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        SIZE_CLASS[size],
        className,
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          aria-label="Cerrar"
          className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-md text-text-3 transition-colors hover:bg-surface-alt hover:text-foreground"
        >
          <X size={14} strokeWidth={1.6} />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-1.5 border-b border-border px-6 py-5",
        className,
      )}
      {...props}
    />
  )
}

/**
 * Body con scroll cuando el contenido excede la altura del modal. Para que
 * funcione, el ancestro directo (Dialog content o un `<form>` envolvente)
 * debe ser flex column. `min-h-0` es lo que habilita al body a achicarse en
 * vez de empujar al footer fuera de pantalla.
 */
export function DialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5", className)}
      {...props}
    />
  )
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-alt px-6 py-4",
        className,
      )}
      {...props}
    />
  )
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "font-serif text-[22px] font-normal leading-[1.2] tracking-[-0.01em] text-foreground",
      className,
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-[13.5px] leading-[1.5] text-text-2", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName
