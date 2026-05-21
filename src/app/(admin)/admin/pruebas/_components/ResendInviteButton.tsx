"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, MailX, Send } from "lucide-react"
import { resendTestInvite } from "@/modules/tests/invites/resend.action"

/**
 * Reenvía el correo de invitación. Solo se habilita en estados PENDING — en
 * el resto no tiene efecto (el candidato ya inició o el token venció).
 */
export function ResendInviteButton({
  inviteId,
  disabled,
  disabledHint,
}: {
  inviteId: string
  disabled?: boolean
  disabledHint?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState<"ok" | "error" | null>(null)

  function send() {
    if (disabled) return
    startTransition(async () => {
      const result = await resendTestInvite(inviteId)
      if (result.success) {
        setDone("ok")
        setTimeout(() => setDone(null), 1500)
        router.refresh()
      } else {
        setDone("error")
        setTimeout(() => setDone(null), 2500)
      }
    })
  }

  const Icon = done === "ok" ? Check : done === "error" ? MailX : Send
  const iconClass =
    done === "ok" ? "text-teal-500" : done === "error" ? "text-danger" : "text-text-3"

  return (
    <button
      type="button"
      onClick={send}
      disabled={disabled || isPending}
      aria-label="Reenviar invitación"
      title={
        disabled
          ? (disabledHint ?? "No se puede reenviar")
          : done === "ok"
            ? "Reenviado"
            : done === "error"
              ? "No se pudo reenviar"
              : "Reenviar invitación"
      }
      className={`border-border bg-surface ${iconClass} hover:border-border-strong hover:text-foreground grid h-7 w-7 place-items-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <Icon size={13} strokeWidth={1.6} />
    </button>
  )
}
