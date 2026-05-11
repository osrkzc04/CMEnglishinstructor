"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Loader2 } from "lucide-react"
import { UserStatus } from "@prisma/client"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  NewTeacherSchema,
  type NewTeacherInput,
} from "@/modules/teachers/schemas"
import { createTeacher } from "@/modules/teachers/create.action"
import type { CefrLanguageGroup } from "@/modules/teachers/queries"
import { AvailabilityGrid } from "../../_components/AvailabilityGrid"
import { cn } from "@/lib/utils"

type Props = {
  cefrGroups: CefrLanguageGroup[]
}

const EMPTY: NewTeacherInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: undefined,
  document: undefined,
  status: UserStatus.ACTIVE,
  levelIds: [],
  blocks: [],
}

export function NewTeacherForm({ cefrGroups }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setError,
    setValue,
    watch,
  } = useForm<NewTeacherInput>({
    resolver: zodResolver(NewTeacherSchema),
    defaultValues: EMPTY,
  })

  const selectedLevels = watch("levelIds") ?? []

  function toggleLevel(levelId: string) {
    const next = selectedLevels.includes(levelId)
      ? selectedLevels.filter((id) => id !== levelId)
      : [...selectedLevels, levelId]
    setValue("levelIds", next, { shouldValidate: true, shouldDirty: true })
  }

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const result = await createTeacher(data)
      if (!result.success) {
        if (result.field) {
          setError(result.field, { type: "server", message: result.error })
        } else {
          setServerError(result.error)
        }
        return
      }
      router.push(`/admin/docentes/${result.teacherId}` as Route)
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" aria-busy={isPending}>
      {serverError && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos crear el docente"
          description={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      <Section title="Datos personales">
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
          <Field id="phone" label="Teléfono" optional error={errors.phone?.message}>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+593 …"
              aria-invalid={errors.phone ? "true" : undefined}
              {...register("phone")}
            />
          </Field>
          <Field
            id="document"
            label="Documento"
            optional
            error={errors.document?.message}
          >
            <Input
              id="document"
              placeholder="Cédula o pasaporte"
              aria-invalid={errors.document ? "true" : undefined}
              {...register("document")}
            />
          </Field>
          <Field id="status" label="Estado" error={errors.status?.message}>
            <select
              id="status"
              className={cn(
                "block w-full rounded-md border border-border bg-surface px-3 py-2 text-[13.5px] text-foreground",
                "transition-colors duration-[150ms] hover:border-border-strong focus:border-teal-500 focus:outline-none",
              )}
              {...register("status")}
            >
              <option value={UserStatus.ACTIVE}>Activo</option>
              <option value={UserStatus.INACTIVE}>Inactivo</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Niveles que puede dictar">
        <Controller
          control={control}
          name="levelIds"
          render={() => (
            <div className="space-y-5">
              {cefrGroups.length === 0 ? (
                <p className="text-[13px] text-text-3">
                  No hay niveles configurados.
                </p>
              ) : (
                cefrGroups.map((g) => (
                  <div key={g.languageId}>
                    <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
                      {g.languageName}
                    </p>
                    {g.levels.length === 0 ? (
                      <p className="text-[13px] text-text-4">
                        Sin niveles definidos para este idioma.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {g.levels.map((opt) => {
                          const isSelected = selectedLevels.includes(opt.id)
                          return (
                            <label
                              key={opt.id}
                              className={cn(
                                "inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[13px] transition-colors duration-[120ms]",
                                isSelected
                                  ? "border-teal-500/60 bg-teal-500/[0.08] text-foreground"
                                  : "border-border bg-surface text-text-2 hover:border-border-strong hover:text-foreground",
                              )}
                            >
                              <Checkbox
                                checked={isSelected}
                                onChange={() => toggleLevel(opt.id)}
                              />
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
                  </div>
                ))
              )}
            </div>
          )}
        />
        {errors.levelIds && (
          <p className="mt-2 text-[12.5px] text-danger">
            {errors.levelIds.message}
          </p>
        )}
      </Section>

      <Section title="Horario semanal">
        <Controller
          control={control}
          name="blocks"
          render={({ field }) => (
            <AvailabilityGrid
              blocks={field.value}
              onChange={(blocks) => field.onChange(blocks)}
              disabled={isPending}
            />
          )}
        />
        {errors.blocks && typeof errors.blocks.message === "string" && (
          <p className="mt-2 text-[12.5px] text-danger">
            {errors.blocks.message}
          </p>
        )}
      </Section>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => router.push("/admin/docentes" as Route)}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
              Creando…
            </>
          ) : (
            "Crear docente"
          )}
        </Button>
      </div>
    </form>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-surface px-6 py-5">
      <header className="mb-4">
        <h2 className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">
          {title}
        </h2>
      </header>
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
          <span className="font-sans text-[11px] normal-case tracking-normal text-text-4">
            opcional
          </span>
        )}
      </div>
      {children}
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  )
}
