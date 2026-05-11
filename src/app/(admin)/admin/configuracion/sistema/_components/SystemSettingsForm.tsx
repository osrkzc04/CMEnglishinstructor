"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SystemSettingsSchema, type SystemSettingsInput } from "@/modules/settings/schemas"
import { updateSystemSettings } from "@/modules/settings/update.action"

/**
 * Form de "Parámetros del sistema". Estructura:
 *
 *   - Sección "Clases" → duración por defecto (minutos).
 *   - Sección "Aulas" → mín/máx de horas semanales.
 *   - Sección "Asistencia" → toggle "ausencia cuenta como consumida".
 *
 * Cada campo tiene su descripción al lado para que el operador entienda
 * el efecto antes de cambiar nada. Los settings que afectan al histórico
 * se aclaran explícitamente — el copy "no afecta aulas existentes"
 * elimina la duda más frecuente.
 *
 * El form muestra el banner de éxito por unos segundos después de guardar,
 * sin redireccionar — el operador puede ajustar varios settings en
 * sesiones cortas sin perder el contexto.
 */

type Props = {
  initialValues: SystemSettingsInput
}

export function SystemSettingsForm({ initialValues }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<SystemSettingsInput>({
    resolver: zodResolver(SystemSettingsSchema),
    defaultValues: initialValues,
  })

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await updateSystemSettings(data)
      if (!result.success) {
        setServerError(result.error)
        return
      }
      setSuccess(true)
      reset(data) // limpia el dirty state con los valores recién persistidos
      router.refresh()
      // Auto-hide del banner de éxito después de 3.5 s.
      window.setTimeout(() => setSuccess(false), 3500)
    })
  })

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="max-w-2xl space-y-8"
      aria-label="Parámetros del sistema"
    >
      {serverError && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos guardar"
          description={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      {success && (
        <Alert
          variant="teal"
          icon={<CheckCircle2 size={16} strokeWidth={1.6} />}
          title="Cambios guardados"
          description="Los nuevos valores aplican a las aulas y matrículas que se creen de aquí en adelante."
          onDismiss={() => setSuccess(false)}
        />
      )}

      <Section title="Clases" description="Cómo se mide una clase y cuánto dura por defecto.">
        <NumberField
          label="Duración por defecto"
          unit="minutos"
          hint="Valor inicial al crear un curso nuevo. No afecta aulas ya creadas (cada aula guarda un snapshot al momento de su creación)."
          error={errors.classDefaultDurationMinutes?.message}
          inputProps={{
            ...register("classDefaultDurationMinutes"),
            type: "number",
            min: 15,
            max: 180,
            step: 1,
          }}
        />
      </Section>

      <Section title="Aulas" description="Carga semanal recomendada al armar un aula nueva.">
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField
            label="Mínimo semanal"
            unit="horas"
            hint="Mínimo de horas a la semana que un aula debe ofrecer."
            error={errors.weeklyMinHours?.message}
            inputProps={{
              ...register("weeklyMinHours"),
              type: "number",
              min: 1,
              max: 40,
              step: 1,
            }}
          />
          <NumberField
            label="Máximo semanal"
            unit="horas"
            hint="Tope sugerido para no sobrecargar al docente."
            error={errors.weeklyMaxHours?.message}
            inputProps={{
              ...register("weeklyMaxHours"),
              type: "number",
              min: 1,
              max: 40,
              step: 1,
            }}
          />
        </div>
      </Section>

      <Section
        title="Asistencia"
        description="Cómo se contabilizan las ausencias contra el saldo de horas del estudiante."
      >
        <Controller
          control={control}
          name="absenceCountsAsConsumed"
          render={({ field }) => (
            <ToggleRow
              label="Una ausencia cuenta como hora consumida"
              hint="Si está activo, una clase a la que el estudiante no asiste igual descuenta de su saldo. Si está apagado, las ausencias no descuentan."
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </Section>

      <div className="border-border flex items-center justify-end gap-3 border-t pt-6">
        <Button type="submit" variant="primary" size="lg" disabled={isPending || !isDirty}>
          {isPending ? (
            <>
              <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
              Guardando…
            </>
          ) : (
            "Guardar cambios"
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
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <header className="mb-4">
        <h2 className="text-foreground font-serif text-[20px] leading-tight font-normal tracking-[-0.01em]">
          {title}
        </h2>
        {description && <p className="text-text-3 mt-1 text-[13px] leading-[1.5]">{description}</p>}
      </header>
      {children}
    </section>
  )
}

function NumberField({
  label,
  unit,
  hint,
  error,
  inputProps,
}: {
  label: string
  unit?: string
  hint?: string
  error?: string
  inputProps: React.InputHTMLAttributes<HTMLInputElement>
}) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      <div className="relative">
        <Input {...inputProps} aria-invalid={!!error} className={unit ? "pr-20" : undefined} />
        {unit && (
          <span className="text-text-4 pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[11.5px] tracking-[0.06em] uppercase">
            {unit}
          </span>
        )}
      </div>
      {error ? (
        <p className="text-danger mt-1.5 text-[12.5px]">{error}</p>
      ) : hint ? (
        <p className="text-text-3 mt-1.5 text-[12.5px] leading-[1.5]">{hint}</p>
      ) : null}
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="border-border bg-surface flex items-start justify-between gap-6 rounded-xl border p-4">
      <div className="min-w-0">
        <p className="text-foreground text-[14px]">{label}</p>
        {hint && <p className="text-text-3 mt-1 text-[12.5px] leading-[1.5]">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
