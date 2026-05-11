"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Turnstile } from "@marsidev/react-turnstile"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox, CheckLabel } from "@/components/ui/checkbox"
import {
  PublicApplicationSchema,
  type PublicApplicationInput,
} from "@/modules/teachers/applications/publicSchemas"
import { createPublicApplication } from "@/modules/teachers/applications/createPublic.action"
import type { CefrLanguageGroup } from "@/modules/teachers/queries"
import { AvailabilityGrid } from "@/app/(admin)/admin/docentes/_components/AvailabilityGrid"

/**
 * Form público de postulación. Usa el mismo `AvailabilityGrid` que admin
 * para que la disponibilidad propuesta llegue ya estructurada como
 * bloques compactos de 15 min.
 *
 * Si `turnstileSiteKey` está vacío (dev sin captcha) el widget no se
 * monta y se inyecta un token placeholder; la action lo acepta porque
 * `verifyTurnstile` se omite cuando falta el secret server-side.
 */

type Props = {
  levelGroups: CefrLanguageGroup[]
  turnstileSiteKey: string
}

const DEV_BYPASS_TOKEN = "dev-bypass"

export function PublicApplicationForm({
  levelGroups,
  turnstileSiteKey,
}: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PublicApplicationInput>({
    resolver: zodResolver(PublicApplicationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      document: "",
      bio: "",
      levelIds: [],
      availability: [],
      consentAccepted: undefined as unknown as true,
      turnstileToken: "",
    },
  })

  const bioValue = watch("bio") ?? ""

  // Sin site key, inyectamos token de bypass para que el schema valide y la
  // action procese (ya que el server tampoco verifica si TURNSTILE_SECRET_KEY
  // está vacío).
  useEffect(() => {
    if (!turnstileSiteKey) setValue("turnstileToken", DEV_BYPASS_TOKEN)
  }, [turnstileSiteKey, setValue])

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const result = await createPublicApplication(data)
      if (!result.success) {
        setServerError(result.error)
        // Reset del token Turnstile — un token solo es válido una vez.
        if (turnstileSiteKey) setValue("turnstileToken", "")
        return
      }
      router.push("/postular-docente/gracias")
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-10">
      {serverError && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos enviar la postulación"
          description={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      <Section title="Tus datos">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombres" error={errors.firstName?.message} required>
            <Input
              {...register("firstName")}
              autoComplete="given-name"
              aria-invalid={!!errors.firstName}
            />
          </Field>
          <Field label="Apellidos" error={errors.lastName?.message} required>
            <Input
              {...register("lastName")}
              autoComplete="family-name"
              aria-invalid={!!errors.lastName}
            />
          </Field>
          <Field label="Correo electrónico" error={errors.email?.message} required>
            <Input
              {...register("email")}
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
            />
          </Field>
          <Field label="Teléfono" error={errors.phone?.message} required>
            <Input
              {...register("phone")}
              type="tel"
              autoComplete="tel"
              aria-invalid={!!errors.phone}
            />
          </Field>
          <Field
            label="Cédula o pasaporte"
            error={errors.document?.message}
            required
            className="sm:col-span-2"
          >
            <Input
              {...register("document")}
              aria-invalid={!!errors.document}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Niveles que puedes impartir"
        hint="Marca todos los niveles para los que estás capacitado."
      >
        <Controller
          control={control}
          name="levelIds"
          render={({ field }) => (
            <LevelMultiselect
              groups={levelGroups}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {errors.levelIds && (
          <p className="mt-2 text-[12.5px] text-danger">
            {errors.levelIds.message}
          </p>
        )}
      </Section>

      <Section
        title="Cuéntanos sobre tu experiencia"
        hint="Mínimo 300 caracteres. Es lo que vamos a leer para decidir si avanzar a entrevista."
      >
        <textarea
          {...register("bio")}
          rows={8}
          aria-invalid={!!errors.bio}
          className="block w-full rounded-lg border border-border bg-surface px-3.5 py-3 text-[14px] leading-[1.5] text-foreground placeholder:text-text-4 transition-[border-color] hover:border-border-strong focus:border-teal-500 focus:outline-none aria-[invalid=true]:border-danger"
          placeholder="Años de experiencia, contextos en los que has enseñado, certificaciones, metodologías que usas, perfiles de estudiantes con los que has trabajado…"
        />
        <div className="mt-1.5 flex items-center justify-between text-[12px]">
          {errors.bio ? (
            <p className="text-danger">{errors.bio.message}</p>
          ) : (
            <span className="text-text-4">
              {bioValue.length} de 300 mínimo
            </span>
          )}
        </div>
      </Section>

      <Section
        title="Tu disponibilidad semanal"
        hint="Pinta los bloques en los que podrías dictar clases. Click y arrastra para seleccionar varios slots."
      >
        <Controller
          control={control}
          name="availability"
          render={({ field }) => (
            <AvailabilityGrid
              blocks={field.value}
              onChange={(blocks) => field.onChange(blocks)}
              disabled={isPending}
            />
          )}
        />
        {errors.availability && typeof errors.availability.message === "string" && (
          <p className="mt-2 text-[12.5px] text-danger">
            {errors.availability.message}
          </p>
        )}
      </Section>

      <Section title="Antes de enviar">
        <div className="space-y-4">
          <CheckLabel className="items-start gap-3 text-[14px] leading-[1.55]">
            <Controller
              control={control}
              name="consentAccepted"
              render={({ field }) => (
                <Checkbox
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked || undefined)}
                />
              )}
            />
            <span className="text-text-2">
              Acepto que CM English Instructor use mis datos personales para
              evaluar esta postulación y, si avanza, contactarme.
            </span>
          </CheckLabel>
          {errors.consentAccepted && (
            <p className="text-[12.5px] text-danger">
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
        </div>
      </Section>

      <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
              Enviando…
            </>
          ) : (
            "Enviar postulación"
          )}
        </Button>
      </div>
    </form>
  )
}

// -----------------------------------------------------------------------------
//  Sub-componentes
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
    <section>
      <h2 className="font-serif text-[22px] font-normal leading-tight tracking-[-0.01em] text-foreground">
        {title}
      </h2>
      {hint && <p className="mt-1 text-[13.5px] text-text-3">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Field({
  label,
  error,
  required,
  className,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </Label>
      {children}
      {error && <p className="mt-1.5 text-[12.5px] text-danger">{error}</p>}
    </div>
  )
}

function LevelMultiselect({
  groups,
  value,
  onChange,
}: {
  groups: CefrLanguageGroup[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id))
    else onChange([...value, id])
  }
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.languageId}>
          <p className="mb-2.5 text-[12.5px] font-medium uppercase tracking-[0.06em] text-text-3">
            {group.languageName}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.levels.map((lvl) => {
              const checked = value.includes(lvl.id)
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => toggle(lvl.id)}
                  aria-pressed={checked}
                  className={[
                    "rounded-full border px-3.5 py-2 text-[13px] transition-[background-color,border-color,color] duration-[120ms]",
                    checked
                      ? "border-teal-500 bg-teal-500 text-bone"
                      : "border-border bg-surface text-foreground hover:border-border-strong",
                  ].join(" ")}
                >
                  {lvl.code} · {lvl.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
