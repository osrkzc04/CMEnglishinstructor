"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Modality, UserStatus } from "@prisma/client"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Radio, CheckLabel } from "@/components/ui/checkbox"
import {
  NewStudentWithEnrollmentSchema,
  type NewStudentWithEnrollmentInput,
} from "@/modules/students/schemas"
import { createStudentWithEnrollment } from "@/modules/students/createWithEnrollment.action"
import type { ProgramLevelOption } from "@/modules/enrollments/queries"
import { AvailabilityGrid } from "@/app/(admin)/admin/docentes/_components/AvailabilityGrid"
import { cn } from "@/lib/utils"

/**
 * Form de alta de estudiante. Capta datos personales, profesionales,
 * matrícula (programa+modalidad+notas) y horario preferido. La asignación
 * a un aula concreta se hace después desde `/admin/aulas/...`; al alta el
 * alumno siempre queda "en espera de aula".
 *
 * El horario preferido reusa la `AvailabilityGrid` del docente — la grilla
 * es genérica sobre bloques `{dayOfWeek, startTime, endTime}` y los del
 * estudiante tienen el mismo shape estructural que los del docente.
 */

type Props = {
  programLevels: ProgramLevelOption[]
}

const MODALITY_OPTIONS: {
  value: Modality
  label: string
  hint: string
}[] = [
  { value: Modality.VIRTUAL, label: "Virtual", hint: "Por videollamada" },
  { value: Modality.PRESENCIAL, label: "Presencial", hint: "En sede o cliente" },
  { value: Modality.HIBRIDO, label: "Híbrida", hint: "Combina las dos" },
]

const STATUS_OPTIONS: { value: UserStatus; label: string; hint: string }[] = [
  { value: UserStatus.ACTIVE, label: "Activo", hint: "Puede iniciar sesión apenas defina su contraseña" },
  {
    value: UserStatus.PENDING_APPROVAL,
    label: "Pendiente",
    hint: "Para casos donde falta validar algún dato (ej. prueba de ubicación)",
  },
  { value: UserStatus.INACTIVE, label: "Inactivo", hint: "No puede iniciar sesión" },
]

export function NewStudentForm({ programLevels }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const grouped = useMemo(() => groupProgramLevels(programLevels), [programLevels])

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setError,
    setValue,
    watch,
  } = useForm<NewStudentWithEnrollmentInput>({
    resolver: zodResolver(NewStudentWithEnrollmentSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: undefined,
      document: undefined,
      status: UserStatus.ACTIVE,
      company: undefined,
      position: undefined,
      studentNotes: undefined,
      programLevelId: "",
      modality: undefined as unknown as Modality,
      enrollmentNotes: undefined,
      preferredSchedule: [],
    },
  })

  const watchedStatus = watch("status")
  const watchedModality = watch("modality")

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const result = await createStudentWithEnrollment(data)
      if (!result.success) {
        if (result.field) {
          setError(result.field, { type: "server", message: result.error })
        } else {
          setServerError(result.error)
        }
        return
      }
      router.push(`/admin/estudiantes/${result.studentId}` as Route)
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos crear al estudiante"
          description={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      <Section title="Datos personales">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="firstName" label="Nombres" error={errors.firstName?.message}>
            <Input
              id="firstName"
              autoComplete="given-name"
              {...register("firstName")}
            />
          </Field>
          <Field id="lastName" label="Apellidos" error={errors.lastName?.message}>
            <Input
              id="lastName"
              autoComplete="family-name"
              {...register("lastName")}
            />
          </Field>
          <Field id="email" label="Correo" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
            />
          </Field>
          <Field id="phone" label="Teléfono" optional error={errors.phone?.message}>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+593…"
              {...register("phone")}
            />
          </Field>
          <Field
            id="document"
            label="Cédula o pasaporte"
            optional
            error={errors.document?.message}
            className="sm:col-span-2"
          >
            <Input id="document" {...register("document")} />
          </Field>
        </div>
      </Section>

      <Section
        title="Estado de la cuenta"
        hint="Define si el alumno puede iniciar sesión apenas active su acceso."
      >
        <StatusPicker
          value={watchedStatus}
          onChange={(s) =>
            setValue("status", s, { shouldValidate: true, shouldDirty: true })
          }
        />
      </Section>

      <Section title="Datos profesionales" optional>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="company" label="Empresa" optional error={errors.company?.message}>
            <Input id="company" {...register("company")} />
          </Field>
          <Field id="position" label="Cargo" optional error={errors.position?.message}>
            <Input id="position" {...register("position")} />
          </Field>
        </div>
        <Field
          id="studentNotes"
          label="Notas internas"
          optional
          error={errors.studentNotes?.message}
          className="mt-4"
        >
          <Textarea
            id="studentNotes"
            rows={3}
            placeholder="Para uso de coordinación. No las ven el estudiante ni el docente."
            {...register("studentNotes")}
          />
        </Field>
      </Section>

      <Section title="Matrícula">
        <Field
          id="programLevelId"
          label="Programa y nivel"
          error={errors.programLevelId?.message}
        >
          <select
            id="programLevelId"
            className={cn(
              "block w-full rounded-md border border-border bg-surface px-3 py-2.5 text-[13.5px] text-foreground",
              "transition-colors duration-[150ms] hover:border-border-strong focus:border-teal-500 focus:outline-none",
            )}
            {...register("programLevelId")}
          >
            <option value="">Selecciona un nivel…</option>
            {grouped.map((course) => (
              <optgroup key={course.courseId} label={course.courseName}>
                {course.programs.flatMap((program) =>
                  program.levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {program.programName} — {level.name}
                      {level.cefrLevelCode ? ` (CEFR ${level.cefrLevelCode})` : ""}
                    </option>
                  )),
                )}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field
          id="enrollmentNotes"
          label="Notas de la matrícula"
          optional
          error={errors.enrollmentNotes?.message}
          className="mt-4"
        >
          <Textarea
            id="enrollmentNotes"
            rows={2}
            {...register("enrollmentNotes")}
          />
        </Field>
      </Section>

      <Section
        title="Modalidad"
        hint="Cómo va a cursar el alumno."
      >
        <ModalityPicker
          value={watchedModality}
          onChange={(m) =>
            setValue("modality", m, { shouldValidate: true, shouldDirty: true })
          }
          error={errors.modality?.message}
        />
      </Section>

      <Section
        title="Horario preferido"
        hint="Pinta los bloques en los que el estudiante puede tomar clases. Click y arrastra para seleccionar varios slots. Sirve para que coordinación lo ubique en un aula compatible."
        optional
      >
        <Controller
          control={control}
          name="preferredSchedule"
          render={({ field }) => (
            <>
              <AvailabilityGrid
                blocks={field.value}
                onChange={(blocks) => field.onChange(blocks)}
                disabled={isPending}
              />
              <ScheduleSummary blocks={field.value} />
            </>
          )}
        />
        {errors.preferredSchedule?.message && (
          <p className="mt-2 text-[12.5px] text-danger">
            {errors.preferredSchedule.message}
          </p>
        )}
      </Section>

      <p className="rounded-md border border-border bg-surface-alt px-4 py-3 text-[12.5px] leading-[1.55] text-text-3">
        El alumno se crea en{" "}
        <strong className="text-foreground">espera de aula</strong>. La
        asignación a un aula existente o la creación de un aula nueva con
        este alumno se hace desde{" "}
        <strong className="text-foreground">Aulas</strong>.
      </p>

      <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
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
              Creando…
            </>
          ) : (
            "Crear estudiante"
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
  optional,
  children,
}: {
  title: string
  hint?: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-[18px] font-normal tracking-[-0.01em] text-foreground">
          {title}
        </h2>
        {optional && (
          <span className="text-[11px] uppercase tracking-[0.08em] text-text-4">
            opcional
          </span>
        )}
      </div>
      {hint && (
        <p className="mb-4 text-[13px] leading-[1.5] text-text-3">{hint}</p>
      )}
      {!hint && <div className="mb-4" />}
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
        {optional && <span className="text-[11px] text-text-4">opcional</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  )
}

function StatusPicker({
  value,
  onChange,
}: {
  value: UserStatus
  onChange: (s: UserStatus) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {STATUS_OPTIONS.map((opt) => (
        <CheckLabel
          key={opt.value}
          className={cn(
            "items-start gap-3 rounded-md border px-4 py-3 transition-colors",
            value === opt.value
              ? "border-teal-500 bg-teal-500/[0.06]"
              : "border-border bg-surface hover:border-border-strong",
          )}
        >
          <Radio
            name="status"
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span>
            <span className="block text-[14px] font-medium text-foreground">
              {opt.label}
            </span>
            <span className="mt-0.5 block text-[12px] text-text-3">
              {opt.hint}
            </span>
          </span>
        </CheckLabel>
      ))}
    </div>
  )
}

function ModalityPicker({
  value,
  onChange,
  error,
}: {
  value: Modality | undefined
  onChange: (m: Modality) => void
  error?: string
}) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-3">
        {MODALITY_OPTIONS.map((opt) => (
          <CheckLabel
            key={opt.value}
            className={cn(
              "items-start gap-3 rounded-md border px-4 py-3 transition-colors",
              value === opt.value
                ? "border-teal-500 bg-teal-500/[0.06]"
                : "border-border bg-surface hover:border-border-strong",
            )}
          >
            <Radio
              name="modality"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span>
              <span className="block text-[14px] font-medium text-foreground">
                {opt.label}
              </span>
              <span className="mt-0.5 block text-[12px] text-text-3">
                {opt.hint}
              </span>
            </span>
          </CheckLabel>
        ))}
      </div>
      {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
    </>
  )
}

function ScheduleSummary({
  blocks,
}: {
  blocks: { dayOfWeek: number; startTime: string; endTime: string }[]
}) {
  if (blocks.length === 0) return null

  const sorted = [...blocks].sort((a, b) => {
    const da = a.dayOfWeek === 0 ? 7 : a.dayOfWeek
    const db = b.dayOfWeek === 0 ? 7 : b.dayOfWeek
    if (da !== db) return da - db
    return a.startTime.localeCompare(b.startTime)
  })

  return (
    <div className="mt-4 rounded-md border border-border bg-surface-alt px-4 py-3">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
        Horario seleccionado
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {sorted.map((b, i) => (
          <li
            key={`${b.dayOfWeek}-${b.startTime}-${i}`}
            className="rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-[12px] tracking-[0.02em] text-foreground"
          >
            {DAY_SHORT_LABELS[b.dayOfWeek]}. {b.startTime} - {b.endTime}
          </li>
        ))}
      </ul>
    </div>
  )
}

const DAY_SHORT_LABELS: Record<number, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
}

// -----------------------------------------------------------------------------
//  Agrupador de programLevels para optgroup
// -----------------------------------------------------------------------------

type ProgramLevelGroup = {
  courseId: string
  courseName: string
  programs: {
    programId: string
    programName: string
    levels: ProgramLevelOption[]
  }[]
}

function groupProgramLevels(levels: ProgramLevelOption[]): ProgramLevelGroup[] {
  const courses = new Map<string, ProgramLevelGroup>()
  for (const lvl of levels) {
    let course = courses.get(lvl.courseId)
    if (!course) {
      course = { courseId: lvl.courseId, courseName: lvl.courseName, programs: [] }
      courses.set(lvl.courseId, course)
    }
    let program = course.programs.find((p) => p.programId === lvl.programId)
    if (!program) {
      program = {
        programId: lvl.programId,
        programName: lvl.programName,
        levels: [],
      }
      course.programs.push(program)
    }
    program.levels.push(lvl)
  }
  return Array.from(courses.values())
}
