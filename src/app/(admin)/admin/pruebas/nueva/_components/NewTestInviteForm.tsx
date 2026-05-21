"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, ArrowRight, Check, Copy, Loader2, Mail } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CheckLabel, Radio } from "@/components/ui/checkbox"
import { NewTestInviteSchema, type NewTestInviteInput } from "@/modules/tests/invites/schemas"
import { createTestInvite } from "@/modules/tests/invites/create.action"
import { cn } from "@/lib/utils"

type Template = { id: string; name: string; timeLimitMinutes: number }

type Result = {
  inviteId: string
  link: string
  expiresAt: Date
  emailQueued: boolean
  candidateEmail: string
}

const EXPIRATION_OPTIONS: { value: number; label: string; hint: string }[] = [
  { value: 24, label: "24 horas", hint: "Recomendado: el candidato rinde en el día siguiente" },
  { value: 48, label: "48 horas", hint: "Para coordinar con candidatos en otra zona horaria" },
  { value: 72, label: "72 horas", hint: "Margen amplio si el candidato es difícil de ubicar" },
]

export function NewTestInviteForm({ templates }: { templates: Template[] }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [isPending, startTransition] = useTransition()

  const defaultTemplateId = templates[0]?.id ?? ""

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    setValue,
    watch,
  } = useForm<NewTestInviteInput>({
    resolver: zodResolver(NewTestInviteSchema),
    defaultValues: {
      templateId: defaultTemplateId,
      candidateName: "",
      candidateEmail: "",
      candidatePhone: undefined,
      candidateDocument: undefined,
      notes: undefined,
      expiresInHours: 24,
    },
  })

  const watchedExpiration = watch("expiresInHours")
  const watchedTemplateId = watch("templateId")
  const selectedTemplate = templates.find((t) => t.id === watchedTemplateId) ?? templates[0]

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const response = await createTestInvite(data)
      if (!response.success) {
        if (response.field) {
          setError(response.field, { type: "server", message: response.error })
        } else {
          setServerError(response.error)
        }
        return
      }
      setResult({
        inviteId: response.inviteId,
        link: response.link,
        expiresAt: response.expiresAt,
        emailQueued: response.emailQueued,
        candidateEmail: data.candidateEmail,
      })
    })
  })

  if (result) {
    return <InviteCreatedPanel result={result} />
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos crear la invitación"
          description={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      <Section title="Datos del candidato">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="candidateName"
            label="Nombre completo"
            error={errors.candidateName?.message}
            className="sm:col-span-2"
          >
            <Input id="candidateName" autoComplete="name" {...register("candidateName")} />
          </Field>
          <Field id="candidateEmail" label="Correo" error={errors.candidateEmail?.message}>
            <Input
              id="candidateEmail"
              type="email"
              autoComplete="email"
              {...register("candidateEmail")}
            />
          </Field>
          <Field
            id="candidatePhone"
            label="Teléfono"
            optional
            error={errors.candidatePhone?.message}
          >
            <Input
              id="candidatePhone"
              type="tel"
              autoComplete="tel"
              placeholder="+593…"
              {...register("candidatePhone")}
            />
          </Field>
          <Field
            id="candidateDocument"
            label="Cédula o pasaporte"
            optional
            error={errors.candidateDocument?.message}
            className="sm:col-span-2"
          >
            <Input id="candidateDocument" {...register("candidateDocument")} />
          </Field>
          <Field
            id="notes"
            label="Notas internas"
            optional
            error={errors.notes?.message}
            className="sm:col-span-2"
          >
            <Textarea
              id="notes"
              rows={3}
              placeholder="Empresa, motivo, persona de contacto…"
              {...register("notes")}
            />
          </Field>
        </div>
      </Section>

      {templates.length > 1 && (
        <Section title="Plantilla de evaluación" hint="Define qué examen rinde el candidato.">
          <div className="space-y-2">
            {templates.map((t) => (
              <CheckLabel
                key={t.id}
                className={cn(
                  "items-start gap-3 rounded-md border px-4 py-3 transition-colors",
                  watchedTemplateId === t.id
                    ? "border-teal-500 bg-teal-500/[0.06]"
                    : "border-border bg-surface hover:border-border-strong",
                )}
              >
                <Radio
                  name="templateId"
                  value={t.id}
                  checked={watchedTemplateId === t.id}
                  onChange={() =>
                    setValue("templateId", t.id, { shouldValidate: true, shouldDirty: true })
                  }
                />
                <span>
                  <span className="text-foreground block text-[14px] font-medium">{t.name}</span>
                  <span className="text-text-3 mt-0.5 block text-[12px]">
                    Duración aproximada: {t.timeLimitMinutes} minutos
                  </span>
                </span>
              </CheckLabel>
            ))}
            {errors.templateId && (
              <p className="text-danger mt-1 text-[12.5px]">{errors.templateId.message}</p>
            )}
          </div>
        </Section>
      )}

      {templates.length === 1 && selectedTemplate && (
        <input type="hidden" {...register("templateId")} value={selectedTemplate.id} />
      )}

      <Section
        title="Vigencia del enlace"
        hint="A partir de qué momento el enlace deja de funcionar. Después de eso hay que crear una invitación nueva."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {EXPIRATION_OPTIONS.map((opt) => (
            <CheckLabel
              key={opt.value}
              className={cn(
                "items-start gap-3 rounded-md border px-4 py-3 transition-colors",
                watchedExpiration === opt.value
                  ? "border-teal-500 bg-teal-500/[0.06]"
                  : "border-border bg-surface hover:border-border-strong",
              )}
            >
              <Radio
                name="expiresInHours"
                value={String(opt.value)}
                checked={watchedExpiration === opt.value}
                onChange={() =>
                  setValue("expiresInHours", opt.value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              />
              <span>
                <span className="text-foreground block text-[14px] font-medium">{opt.label}</span>
                <span className="text-text-3 mt-0.5 block text-[12px]">{opt.hint}</span>
              </span>
            </CheckLabel>
          ))}
        </div>
      </Section>

      <div className="border-border flex items-center justify-end gap-3 border-t pt-5">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
              Generando enlace…
            </>
          ) : (
            <>
              Generar enlace y enviar correo
              <ArrowRight size={14} strokeWidth={1.6} />
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

// -----------------------------------------------------------------------------
//  Panel de éxito
// -----------------------------------------------------------------------------

function InviteCreatedPanel({ result }: { result: Result }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // noop
    }
  }

  return (
    <div className="border-border bg-surface space-y-5 rounded-xl border p-6">
      <div>
        <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
          Evaluación creada
        </p>
        <h2 className="text-foreground mt-1 font-serif text-[22px] font-normal tracking-[-0.01em]">
          Enlace listo
        </h2>
        <p className="text-text-3 mt-2 text-[13.5px] leading-[1.55]">
          {result.emailQueued ? (
            <>
              <Mail
                size={13}
                strokeWidth={1.6}
                className="-mt-0.5 mr-1 inline-block align-middle text-teal-500"
              />
              Enviamos el correo a <span className="text-foreground">{result.candidateEmail}</span>.
              Si no llega en unos minutos, revisa spam o copia el enlace y compártelo por otra vía.
            </>
          ) : (
            "El correo quedó encolado. Si no llega, copia el enlace de abajo y compártelo manualmente."
          )}
        </p>
      </div>

      <div className="border-border bg-surface-alt rounded-md border p-4">
        <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">Enlace</p>
        <div className="mt-1.5 flex items-start gap-3">
          <code className="text-foreground flex-1 font-mono text-[12.5px] leading-[1.5] break-all">
            {result.link}
          </code>
          <button
            type="button"
            onClick={copy}
            className="border-border bg-surface text-text-3 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors hover:border-teal-500 hover:text-teal-500"
          >
            {copied ? (
              <>
                <Check size={12} strokeWidth={1.8} className="text-teal-500" />
                Copiado
              </>
            ) : (
              <>
                <Copy size={12} strokeWidth={1.6} />
                Copiar
              </>
            )}
          </button>
        </div>
        <p className="text-text-3 mt-2 font-mono text-[11.5px] tracking-[0.02em]">
          Vence el {formatExpires(result.expiresAt)}
        </p>
      </div>

      <div className="border-border flex items-center justify-end gap-3 border-t pt-5">
        <a
          href={"/admin/pruebas/nueva" as Route}
          className="text-text-3 hover:text-foreground text-[13px] transition-colors"
        >
          Crear otra
        </a>
        <a
          href={"/admin/pruebas" as Route}
          className="bg-ink-900 dark:bg-bone text-bone dark:text-ink-900 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13.5px] font-medium transition-colors hover:bg-teal-500"
        >
          Volver al listado
          <ArrowRight size={13} strokeWidth={1.6} />
        </a>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
//  Sección y campo (idénticos al patrón usado en NewStaffForm)
// -----------------------------------------------------------------------------

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-border bg-surface rounded-xl border p-5 sm:p-6">
      <h2 className="text-foreground font-serif text-[18px] font-normal tracking-[-0.01em]">
        {title}
      </h2>
      {hint ? (
        <p className="text-text-3 mt-1 mb-4 text-[13px] leading-[1.5]">{hint}</p>
      ) : (
        <div className="mb-4" />
      )}
      {children}
    </section>
  )
}

function Field({
  id,
  label,
  optional,
  error,
  className,
  children,
}: {
  id: string
  label: string
  optional?: boolean
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {optional && <span className="text-text-4 text-[11px]">opcional</span>}
      </div>
      {children}
      {error && <p className="text-danger mt-1 text-[12px]">{error}</p>}
    </div>
  )
}

const expiresFormatter = new Intl.DateTimeFormat("es-EC", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
})

function formatExpires(d: Date): string {
  return expiresFormatter.format(d)
}
