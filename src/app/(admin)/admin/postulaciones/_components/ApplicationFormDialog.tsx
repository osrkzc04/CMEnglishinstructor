"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import type { Route } from "next"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ApplicationFormSchema,
  type ApplicationFormInput,
} from "@/modules/teachers/applications/schemas"
import { updateApplication } from "@/modules/teachers/applications/update.action"
import type { CefrOption } from "@/modules/teachers/applications/queries"
import { cn } from "@/lib/utils"

/**
 * Form de edición de TeacherApplication. El alta llega solo por el form
 * público — la coordinación no crea postulaciones desde admin.
 *
 * El Server Component padre lo monta cuando `searchParams.action === "edit"`;
 * al cerrar, este componente limpia los params relacionados y refresca para
 * que el listado tome el cambio.
 */

type Props = {
  applicationId: string
  initialValues: ApplicationFormInput
  cefrOptions: CefrOption[]
}

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

export function ApplicationFormDialog({ applicationId, initialValues, cefrOptions }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
    watch,
    setValue,
  } = useForm<ApplicationFormInput>({
    resolver: zodResolver(ApplicationFormSchema),
    defaultValues: initialValues,
  })

  // Cuando cambia el applicationId (abrir otra postulación sin desmontar)
  // hidratamos el form con los valores correctos.
  useEffect(() => {
    reset(initialValues)
    setServerError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId])

  const { fields, append, remove } = useFieldArray({
    control,
    name: "availability",
  })

  const watchedLevelIds = watch("levelIds")

  function closeDialog() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("action")
    params.delete("id")
    const qs = params.toString()
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route)
  }

  function toggleLevel(levelId: string) {
    const current = watchedLevelIds ?? []
    setValue(
      "levelIds",
      current.includes(levelId) ? current.filter((id) => id !== levelId) : [...current, levelId],
      { shouldValidate: true, shouldDirty: true },
    )
  }

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const result = await updateApplication(applicationId, data)
      if (!result.success) {
        if (result.field) {
          setError(result.field, { type: "server", message: result.error })
        } else {
          setServerError(result.error)
        }
        return
      }
      closeDialog()
      router.refresh()
    })
  })

  return (
    <Dialog open onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Editar postulación</DialogTitle>
          <DialogDescription>Ajusta los datos antes de aprobar o rechazar.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          noValidate
          aria-busy={isPending}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogBody className="space-y-6">
            {serverError && (
              <Alert
                variant="danger"
                icon={<AlertTriangle size={16} strokeWidth={1.6} />}
                title="No pudimos guardar la postulación"
                description={serverError}
                onDismiss={() => setServerError(null)}
              />
            )}

            {/* Datos personales */}
            <Section title="Datos del postulante">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="firstName" label="Nombre" error={errors.firstName?.message}>
                  <Input
                    id="firstName"
                    autoComplete="given-name"
                    aria-invalid={errors.firstName ? "true" : undefined}
                    {...register("firstName")}
                  />
                </Field>
                <Field id="lastName" label="Apellido" error={errors.lastName?.message}>
                  <Input
                    id="lastName"
                    autoComplete="family-name"
                    aria-invalid={errors.lastName ? "true" : undefined}
                    {...register("lastName")}
                  />
                </Field>
                <Field id="email" label="Correo" error={errors.email?.message}>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={errors.email ? "true" : undefined}
                    {...register("email")}
                  />
                </Field>
                <Field id="phone" label="Teléfono" error={errors.phone?.message}>
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+593 …"
                    aria-invalid={errors.phone ? "true" : undefined}
                    {...register("phone")}
                  />
                </Field>
                <Field id="document" label="Documento" error={errors.document?.message}>
                  <Input
                    id="document"
                    placeholder="Cédula o pasaporte"
                    aria-invalid={errors.document ? "true" : undefined}
                    {...register("document")}
                  />
                </Field>
              </div>

              <Field
                id="bio"
                label="Bio / experiencia"
                error={errors.bio?.message}
                optional
                className="mt-4"
              >
                <Textarea
                  id="bio"
                  rows={4}
                  placeholder="Reseña corta de su experiencia, certificaciones, intereses…"
                  aria-invalid={errors.bio ? "true" : undefined}
                  {...register("bio")}
                />
              </Field>
            </Section>

            {/* Niveles CEFR */}
            <Section title="Niveles que puede dictar">
              {cefrOptions.length === 0 ? (
                <p className="text-text-3 text-[13px]">No hay niveles disponibles.</p>
              ) : (
                <Controller
                  control={control}
                  name="levelIds"
                  render={() => (
                    <div className="flex flex-wrap gap-2">
                      {cefrOptions.map((opt) => {
                        const selected = (watchedLevelIds ?? []).includes(opt.id)
                        return (
                          <label
                            key={opt.id}
                            className={cn(
                              "inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[13px] transition-colors duration-[120ms]",
                              selected
                                ? "text-foreground border-teal-500/60 bg-teal-500/[0.08]"
                                : "border-border bg-surface text-text-2 hover:border-border-strong hover:text-foreground",
                            )}
                          >
                            <Checkbox checked={selected} onChange={() => toggleLevel(opt.id)} />
                            <span className="font-mono text-[12.5px] tracking-[0.04em]">
                              {opt.code}
                            </span>
                            <span className="text-text-3">·</span>
                            <span>{opt.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                />
              )}
              {errors.levelIds && (
                <p className="text-danger mt-2 text-[12.5px]">{errors.levelIds.message}</p>
              )}
            </Section>

            {/* Disponibilidad */}
            <Section title="Disponibilidad semanal">
              <div className="space-y-2.5">
                {fields.length === 0 && (
                  <p className="text-text-3 text-[13px]">Sin bloques agregados.</p>
                )}

                {fields.map((field, index) => {
                  const slotErrors = errors.availability?.[index]
                  return (
                    <div
                      key={field.id}
                      className="border-border bg-surface-alt grid grid-cols-[1fr_auto_auto_auto] items-end gap-3 rounded-md border px-3 py-3"
                    >
                      <Field
                        id={`availability.${index}.dayOfWeek`}
                        label="Día"
                        error={slotErrors?.dayOfWeek?.message}
                      >
                        <select
                          id={`availability.${index}.dayOfWeek`}
                          className={cn(
                            "border-border bg-surface text-foreground block w-full rounded-md border px-3 py-2 text-[13.5px]",
                            "hover:border-border-strong transition-colors duration-[150ms] focus:border-teal-500 focus:outline-none",
                          )}
                          {...register(`availability.${index}.dayOfWeek`, {
                            valueAsNumber: true,
                          })}
                        >
                          {DAYS_ES.map((d, i) => (
                            <option key={d} value={i}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field
                        id={`availability.${index}.startTime`}
                        label="Desde"
                        error={slotErrors?.startTime?.message}
                      >
                        <input
                          id={`availability.${index}.startTime`}
                          type="time"
                          step={300}
                          className={cn(
                            "border-border bg-surface text-foreground block rounded-md border px-3 py-2 text-[13.5px]",
                            "hover:border-border-strong transition-colors duration-[150ms] focus:border-teal-500 focus:outline-none",
                          )}
                          {...register(`availability.${index}.startTime`)}
                        />
                      </Field>

                      <Field
                        id={`availability.${index}.endTime`}
                        label="Hasta"
                        error={slotErrors?.endTime?.message}
                      >
                        <input
                          id={`availability.${index}.endTime`}
                          type="time"
                          step={300}
                          className={cn(
                            "border-border bg-surface text-foreground block rounded-md border px-3 py-2 text-[13.5px]",
                            "hover:border-border-strong transition-colors duration-[150ms] focus:border-teal-500 focus:outline-none",
                          )}
                          {...register(`availability.${index}.endTime`)}
                        />
                      </Field>

                      <button
                        type="button"
                        aria-label="Eliminar bloque"
                        onClick={() => remove(index)}
                        className="border-border bg-surface text-text-3 hover:border-danger/50 hover:text-danger grid h-9 w-9 place-items-center rounded-md border transition-colors"
                      >
                        <Trash2 size={14} strokeWidth={1.6} />
                      </button>
                    </div>
                  )
                })}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    append({
                      dayOfWeek: 1,
                      startTime: "09:00",
                      endTime: "10:00",
                    })
                  }
                >
                  <Plus size={13} strokeWidth={1.6} />
                  Agregar bloque
                </Button>
              </div>

              {errors.availability && typeof errors.availability.message === "string" && (
                <p className="text-danger mt-2 text-[12.5px]">{errors.availability.message}</p>
              )}
            </Section>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={closeDialog}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// -----------------------------------------------------------------------------
//  Subcomponentes locales
// -----------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-foreground mb-3 font-serif text-[16px] font-normal tracking-[-0.01em]">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Field({
  id,
  label,
  optional,
  error,
  children,
  className,
}: {
  id: string
  label: string
  optional?: boolean
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {optional && (
          <span className="text-text-4 font-sans text-[11px] tracking-normal normal-case">
            opcional
          </span>
        )}
      </div>
      {children}
      {error && <p className="text-danger mt-1 text-[12px]">{error}</p>}
    </div>
  )
}
