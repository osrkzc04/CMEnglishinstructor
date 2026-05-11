"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Turnstile } from "@marsidev/react-turnstile"
import { AlertTriangle, CheckCircle2, Loader2, Send } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox, CheckLabel } from "@/components/ui/checkbox"
import {
  PublicInquirySchema,
  type PublicInquiryInput,
  type InquiryTopic,
} from "@/modules/contact/publicSchemas"
import { createPublicInquiry } from "@/modules/contact/createInquiry.action"
import { cn } from "@/lib/utils"

/**
 * Formulario de contacto del landing. Vive dentro de la sección
 * `MarketingContact` y reemplazó a las tarjetas mailto que existían antes.
 *
 * Comportamiento:
 *   - Validación cliente con React Hook Form + Zod (mismo schema que el
 *     server — single source of truth en `publicSchemas.ts`).
 *   - Submit invoca la server action `createPublicInquiry` que valida
 *     Turnstile, rate-limit y manda el correo a EMAIL_REPLY_TO.
 *   - Si Turnstile site-key está vacío (dev), se inyecta token placeholder
 *     que la action acepta porque server-side también skip cuando falta el
 *     secret. Espejo del patrón en `PublicApplicationForm`.
 *   - En éxito el form se reemplaza por una confirmación editorial; no hay
 *     redirect porque la sección está en medio de la página y queremos que
 *     el usuario siga explorando si quiere.
 */

type Props = {
  turnstileSiteKey: string
}

const DEV_BYPASS_TOKEN = "dev-bypass"

const TOPICS: { value: InquiryTopic; label: string; hint: string }[] = [
  {
    value: "personas",
    label: "Para mí",
    hint: "Inglés general, ejecutivo o español",
  },
  {
    value: "empresas",
    label: "Para mi equipo",
    hint: "Programas corporativos · RRHH",
  },
  {
    value: "otro",
    label: "Otra consulta",
    hint: "Cualquier otro tema",
  },
]

export function ContactForm({ turnstileSiteKey }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PublicInquiryInput>({
    resolver: zodResolver(PublicInquirySchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      topic: "personas",
      message: "",
      consentAccepted: undefined as unknown as true,
      turnstileToken: "",
    },
  })

  // Sin site key inyectamos un placeholder — la action lo acepta porque
  // verifyTurnstile() también se omite cuando falta el secret.
  useEffect(() => {
    if (!turnstileSiteKey) setValue("turnstileToken", DEV_BYPASS_TOKEN)
  }, [turnstileSiteKey, setValue])

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const result = await createPublicInquiry(data)
      if (!result.success) {
        setServerError(result.error)
        // Token Turnstile es de un solo uso — forzamos re-render del widget.
        if (turnstileSiteKey) setValue("turnstileToken", "")
        return
      }
      setSubmittedEmail(data.email)
    })
  })

  if (submittedEmail) {
    return <SuccessCard email={submittedEmail} />
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-2xl border border-border bg-surface p-6 sm:p-8"
    >
      {serverError && (
        <div className="mb-6">
          <Alert
            variant="danger"
            icon={<AlertTriangle size={16} strokeWidth={1.6} />}
            title="No pudimos enviar tu consulta"
            description={serverError}
            onDismiss={() => setServerError(null)}
          />
        </div>
      )}

      <div className="space-y-5">
        <Field label="Tu nombre" error={errors.name?.message} required>
          <Input
            {...register("name")}
            autoComplete="name"
            placeholder="Nombre y apellido"
            aria-invalid={!!errors.name}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Correo" error={errors.email?.message} required>
            <Input
              {...register("email")}
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              aria-invalid={!!errors.email}
            />
          </Field>
          <Field label="Teléfono" hint="Opcional" error={errors.phone?.message}>
            <Input
              {...register("phone")}
              type="tel"
              autoComplete="tel"
              placeholder="09…"
              aria-invalid={!!errors.phone}
            />
          </Field>
        </div>

        <div>
          <Label className="mb-2 block">¿Sobre qué quieres conversar?</Label>
          <Controller
            control={control}
            name="topic"
            render={({ field }) => (
              <TopicChoice value={field.value} onChange={field.onChange} />
            )}
          />
          {errors.topic && (
            <p className="mt-1.5 text-[12.5px] text-danger">
              {errors.topic.message}
            </p>
          )}
        </div>

        <Field
          label="Tu mensaje"
          hint="Cuéntanos un poco quién aprende, para qué y en qué horarios podrías"
          error={errors.message?.message}
          required
        >
          <textarea
            {...register("message")}
            rows={5}
            aria-invalid={!!errors.message}
            placeholder="Por ejemplo: Quiero retomar inglés para mi trabajo. Tengo nivel intermedio y prefiero clases por la noche."
            className="block w-full rounded-lg border border-border bg-background px-3.5 py-3 text-[14px] leading-[1.55] text-foreground placeholder:text-text-4 transition-[border-color] hover:border-border-strong focus:border-teal-500 focus:outline-none aria-[invalid=true]:border-danger"
          />
        </Field>

        <CheckLabel className="items-start gap-3 text-[13.5px] leading-[1.55]">
          <Controller
            control={control}
            name="consentAccepted"
            render={({ field }) => (
              <Checkbox
                checked={!!field.value}
                onChange={(e) =>
                  field.onChange(e.target.checked || undefined)
                }
              />
            )}
          />
          <span className="text-text-2">
            Acepto que CM English Instructor use mis datos para responder esta
            consulta.
          </span>
        </CheckLabel>
        {errors.consentAccepted && (
          <p className="-mt-2 text-[12.5px] text-danger">
            {errors.consentAccepted.message}
          </p>
        )}

        {turnstileSiteKey && (
          <div>
            <Turnstile
              siteKey={turnstileSiteKey}
              onSuccess={(token) => setValue("turnstileToken", token)}
              onError={() => setValue("turnstileToken", "")}
              onExpire={() => setValue("turnstileToken", "")}
              options={{ theme: "light" }}
            />
            {errors.turnstileToken && (
              <p className="mt-1.5 text-[12.5px] text-danger">
                {errors.turnstileToken.message}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-text-3">
            Te respondemos en menos de 24 horas hábiles.
          </p>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2
                  size={14}
                  strokeWidth={1.6}
                  className="animate-spin"
                />
                Enviando…
              </>
            ) : (
              <>
                Enviar consulta
                <Send size={14} strokeWidth={1.6} />
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}

// -----------------------------------------------------------------------------
//  Sub-componentes
// -----------------------------------------------------------------------------

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <Label className="block">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </Label>
        {hint && !error && (
          <span className="text-[12px] text-text-4">{hint}</span>
        )}
      </div>
      {children}
      {error && <p className="mt-1.5 text-[12.5px] text-danger">{error}</p>}
    </div>
  )
}

function TopicChoice({
  value,
  onChange,
}: {
  value: InquiryTopic
  onChange: (next: InquiryTopic) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Tipo de consulta"
      className="grid gap-2 sm:grid-cols-3"
    >
      {TOPICS.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-col items-start rounded-lg border px-3.5 py-3 text-left transition-[background-color,border-color,color] duration-150",
              selected
                ? "border-teal-500 bg-teal-500/[0.06] text-foreground"
                : "border-border bg-background text-foreground hover:border-border-strong",
            )}
          >
            <span className="text-[14px] font-medium leading-tight">
              {opt.label}
            </span>
            <span className="mt-0.5 text-[12px] leading-snug text-text-3">
              {opt.hint}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function SuccessCard({ email }: { email: string }) {
  return (
    <div
      className="rounded-2xl border border-teal-500/40 bg-teal-100/30 p-7 dark:bg-teal-500/10 sm:p-9"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-teal-700 dark:text-teal-500">
        <CheckCircle2 size={20} strokeWidth={1.6} />
        <p className="font-mono text-[11px] uppercase tracking-[0.12em]">
          Consulta enviada
        </p>
      </div>
      <h3 className="mt-3 font-serif text-[26px] leading-[1.18] tracking-[-0.02em] text-foreground sm:text-[30px]">
        ¡Gracias! Recibimos tu mensaje.
      </h3>
      <p className="mt-3 max-w-[460px] text-[15px] leading-[1.6] text-text-2">
        Te respondemos a{" "}
        <span className="font-medium text-foreground">{email}</span> en menos de
        24 horas hábiles. Mientras tanto, puedes seguir explorando los programas
        más arriba.
      </p>
    </div>
  )
}
