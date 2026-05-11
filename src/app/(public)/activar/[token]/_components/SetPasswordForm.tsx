"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Input, InputAction } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { setPasswordWithToken } from "@/modules/auth/setPassword.action"
import { cn } from "@/lib/utils"

type Props = {
  token: string
  variant: "activation" | "reset"
}

export function SetPasswordForm({ token, variant }: Props) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [errors, setErrors] = useState<{
    password?: string
    confirmPassword?: string
  }>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setServerError(null)

    startTransition(async () => {
      const result = await setPasswordWithToken({
        token,
        password,
        confirmPassword,
      })
      if (!result.success) {
        if (result.field === "password") {
          setErrors({ password: result.error })
        } else if (result.field === "confirmPassword") {
          setErrors({ confirmPassword: result.error })
        } else {
          setServerError(result.error)
        }
        return
      }
      const reason =
        result.purpose === "activation" ? "activated" : "reset"
      router.push(`/login?reason=${reason}` as Route)
      router.refresh()
    })
  }

  const ctaLabel = variant === "activation" ? "Activar cuenta" : "Restablecer contraseña"
  const ctaPending = variant === "activation" ? "Activando…" : "Guardando…"

  return (
    <form noValidate onSubmit={handleSubmit} aria-busy={isPending}>
      {serverError && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos guardar tu contraseña"
          description={serverError}
          onDismiss={() => setServerError(null)}
          className="mb-[18px]"
        />
      )}

      <div className="mb-[18px]">
        <Label htmlFor="password" className="mb-2">
          Nueva contraseña
        </Label>
        <Input
          id="password"
          type={showPwd ? "text" : "password"}
          autoComplete="new-password"
          icon={Lock}
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (errors.password)
              setErrors((p) => ({ ...p, password: undefined }))
          }}
          aria-invalid={errors.password ? "true" : undefined}
          endAdornment={
            <InputAction
              aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPwd}
              onClick={() => setShowPwd((v) => !v)}
            >
              {showPwd ? (
                <EyeOff size={15} strokeWidth={1.6} />
              ) : (
                <Eye size={15} strokeWidth={1.6} />
              )}
            </InputAction>
          }
        />
        {errors.password && (
          <p className="mt-1.5 text-[12.5px] leading-[1.4] text-danger" role="alert">
            {errors.password}
          </p>
        )}
      </div>

      <div className="mb-7">
        <Label htmlFor="confirmPassword" className="mb-2">
          Confirmar contraseña
        </Label>
        <Input
          id="confirmPassword"
          type={showPwd ? "text" : "password"}
          autoComplete="new-password"
          icon={Lock}
          placeholder="Repetí la contraseña"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            if (errors.confirmPassword)
              setErrors((p) => ({ ...p, confirmPassword: undefined }))
          }}
          aria-invalid={errors.confirmPassword ? "true" : undefined}
        />
        {errors.confirmPassword && (
          <p className="mt-1.5 text-[12.5px] leading-[1.4] text-danger" role="alert">
            {errors.confirmPassword}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-ink-900 bg-ink-900 px-4 py-3.5 text-[14px] tracking-[0.005em] text-bone",
          "transition-colors duration-[150ms]",
          "hover:bg-teal-500 hover:border-teal-500",
          "dark:bg-bone dark:text-ink-900 dark:border-bone dark:hover:bg-teal-500 dark:hover:text-bone dark:hover:border-teal-500",
          "disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-ink-900 disabled:hover:border-ink-900",
          "dark:disabled:hover:bg-bone dark:disabled:hover:border-bone",
        )}
      >
        {isPending ? (
          <>
            <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
            {ctaPending}
          </>
        ) : (
          <>
            {ctaLabel}
            <ArrowRight size={14} strokeWidth={1.6} />
          </>
        )}
      </button>
    </form>
  )
}
