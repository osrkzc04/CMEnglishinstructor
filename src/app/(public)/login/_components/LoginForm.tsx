"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import type { Route } from "next"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Input, InputAction } from "@/components/ui/input"
import { Label, LabelHint } from "@/components/ui/label"
import { Checkbox, CheckLabel } from "@/components/ui/checkbox"
import { signInWithCredentials } from "@/modules/auth/sign-in.action"
import { LoginSchema } from "@/modules/auth/schemas"
import { cn } from "@/lib/utils"

/**
 * Form del login — design-mockups/Login.html:503-583.
 *
 * Validación con `LoginSchema` (Zod, src/modules/auth/schemas.ts) — los mismos
 * checks que correrá la server action `signInWithCredentials`. Errores de
 * credenciales del servidor se muestran en un Alert danger arriba del form.
 */

type FieldErrors = {
  email?: string
  password?: string
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? undefined

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [keepLoggedIn, setKeepLoggedIn] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const parsed = LoginSchema.safeParse({ email, password })
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === "email" && !next.email) next.email = issue.message
        if (key === "password" && !next.password) next.password = issue.message
      }
      setErrors(next)
      setServerError(null)
      return
    }

    setErrors({})
    setServerError(null)

    startTransition(async () => {
      const result = await signInWithCredentials(parsed.data, callbackUrl)
      if (!result.success) {
        setServerError(result.error)
        return
      }
      router.push(result.redirectTo as Route)
      router.refresh()
    })
  }

  return (
    <form noValidate onSubmit={handleSubmit} aria-busy={isPending}>
      {serverError && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos iniciarte sesión"
          description={serverError}
          onDismiss={() => setServerError(null)}
          className="mb-[18px]"
        />
      )}

      {/* Email */}
      <div className="mb-[18px]">
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
          onChange={(e) => {
            setEmail(e.target.value)
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
          }}
          aria-invalid={errors.email ? "true" : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && <FieldError id="email-error">{errors.email}</FieldError>}
      </div>

      {/* Password */}
      <div className="mb-[18px]">
        <div className="mb-2 flex items-baseline justify-between">
          <Label htmlFor="password">Contraseña</Label>
          <LabelHint>
            <Link
              href={"/recuperar" as Route}
              className="border-border-strong text-text-2 border-b pb-px transition-colors hover:border-teal-500 hover:text-teal-500"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </LabelHint>
        </div>
        <Input
          id="password"
          type={showPwd ? "text" : "password"}
          autoComplete="current-password"
          icon={Lock}
          placeholder="••••••••••"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
          }}
          aria-invalid={errors.password ? "true" : undefined}
          aria-describedby={errors.password ? "password-error" : undefined}
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
        {errors.password && <FieldError id="password-error">{errors.password}</FieldError>}
      </div>

      {/* Keep session */}
      <div className="mt-1 mb-7 flex items-center justify-between">
        <CheckLabel className="text-text-2 text-[13px]">
          <Checkbox checked={keepLoggedIn} onChange={(e) => setKeepLoggedIn(e.target.checked)} />
          Mantener sesión iniciada
        </CheckLabel>
      </div>

      {/* Primary submit */}
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
            Verificando…
          </>
        ) : (
          <>
            Entrar
            <ArrowRight size={14} strokeWidth={1.6} />
          </>
        )}
      </button>
    </form>
  )
}

// -----------------------------------------------------------------------------
//  FieldError — mensaje inline bajo el input
// -----------------------------------------------------------------------------

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="text-danger mt-1.5 text-[12.5px] leading-[1.4]">
      {children}
    </p>
  )
}
