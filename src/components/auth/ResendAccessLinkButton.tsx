"use client"

import { useState, useTransition } from "react"
import { Check, Loader2, Mail } from "lucide-react"
import { resendAccessLink } from "@/modules/auth/resendAccessLink.action"
import { cn } from "@/lib/utils"

/**
 * Botón discreto que reenvía el enlace de acceso (activación o
 * recuperación) al usuario. Mostrar en el detalle de estudiante / docente.
 */

type Props = {
  userId: string
  className?: string
}

export function ResendAccessLinkButton({ userId, className }: Props) {
  const [feedback, setFeedback] = useState<
    | { kind: "ok"; message: string }
    | { kind: "err"; message: string }
    | null
  >(null)
  const [isPending, startTransition] = useTransition()

  function onClick() {
    setFeedback(null)
    startTransition(async () => {
      const result = await resendAccessLink({ userId })
      if (!result.success) {
        setFeedback({ kind: "err", message: result.error })
        return
      }
      setFeedback({
        kind: "ok",
        message:
          result.kind === "activation"
            ? "Enlace de activación enviado."
            : "Enlace de recuperación enviado.",
      })
    })
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12.5px] text-text-2 transition-colors",
          "hover:border-teal-500 hover:text-teal-500",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {isPending ? (
          <Loader2 size={13} strokeWidth={1.6} className="animate-spin" />
        ) : (
          <Mail size={13} strokeWidth={1.6} />
        )}
        Reenviar enlace de acceso
      </button>

      {feedback?.kind === "ok" && (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-3">
          <Check size={13} strokeWidth={1.8} className="text-teal-500" />
          {feedback.message}
        </span>
      )}
      {feedback?.kind === "err" && (
        <span className="text-[12.5px] text-danger">{feedback.message}</span>
      )}
    </div>
  )
}
