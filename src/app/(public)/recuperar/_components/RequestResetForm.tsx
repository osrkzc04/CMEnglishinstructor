"use client"

import { useState, useTransition } from "react"
import { AlertTriangle, ArrowRight, Check, Loader2, Mail } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestPasswordReset } from "@/modules/auth/requestReset.action"
import { cn } from "@/lib/utils"

export function RequestResetForm() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await requestPasswordReset({ email })
      if (!result.success) {
        setError(result.error)
        return
      }
      setSubmitted(true)
    })
  }

  if (submitted) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-teal-500/35 bg-teal-500/[0.06] px-4 py-4">
        <Check size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-teal-500" />
        <div>
          <p className="text-foreground text-[14px] font-medium">Revisá tu correo</p>
          <p className="text-text-2 mt-1 text-[13px] leading-[1.55]">
            Si el correo está registrado, te llegará un enlace para restablecer la contraseña en los
            próximos minutos.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form noValidate onSubmit={handleSubmit} aria-busy={isPending}>
      {error && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos procesar el pedido"
          description={error}
          onDismiss={() => setError(null)}
          className="mb-[18px]"
        />
      )}

      <div className="mb-7">
        <Label htmlFor="email" className="mb-2">
          Correo
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          icon={Mail}
          placeholder="nombre@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          "border-ink-900 bg-ink-900 text-bone inline-flex w-full items-center justify-center gap-2.5 rounded-lg border px-4 py-3.5 text-[14px] tracking-[0.005em]",
          "transition-colors duration-[150ms]",
          "hover:border-teal-500 hover:bg-teal-500",
          "dark:bg-bone dark:text-ink-900 dark:border-bone dark:hover:text-bone dark:hover:border-teal-500 dark:hover:bg-teal-500",
          "disabled:hover:bg-ink-900 disabled:hover:border-ink-900 disabled:cursor-not-allowed disabled:opacity-70",
          "dark:disabled:hover:bg-bone dark:disabled:hover:border-bone",
        )}
      >
        {isPending ? (
          <>
            <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
            Enviando…
          </>
        ) : (
          <>
            Enviar enlace
            <ArrowRight size={14} strokeWidth={1.6} />
          </>
        )}
      </button>
    </form>
  )
}
