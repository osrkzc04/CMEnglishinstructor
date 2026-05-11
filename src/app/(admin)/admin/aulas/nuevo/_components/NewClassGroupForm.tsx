"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Info, Loader2, X } from "lucide-react"
import { Modality } from "@prisma/client"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tag } from "@/components/ui/tag"
import { Radio, CheckLabel, Checkbox } from "@/components/ui/checkbox"
import {
  NewClassGroupSchema,
  type NewClassGroupInput,
} from "@/modules/classGroups/schemas"
import { createClassGroup } from "@/modules/classGroups/create.action"
import { loadAulaCandidates } from "@/modules/classGroups/loadCandidates.action"
import {
  computeAvailabilityHeatmap,
  type Heatmap,
} from "@/modules/classGroups/heatmap"
import { generateClassGroupName } from "@/modules/classGroups/nameGenerator"
import type {
  EligibleStudentCandidate,
  EligibleTeacherCandidate,
} from "@/modules/classGroups/queries"
import type { ProgramLevelOption } from "@/modules/enrollments/queries"
import { cn } from "@/lib/utils"
import { MatchHeatmap } from "./MatchHeatmap"

/**
 * Form de "nueva aula" en modo *availability-driven*.
 *
 * Flujo:
 *   1. Coordinación elige nivel + modalidad. Eso dispara la carga de
 *      candidatos (estudiantes con matrícula libre + docentes elegibles).
 *   2. Coordinación selecciona docente + estudiantes. El heatmap se recalcula
 *      mostrando los horarios donde hay match. Click sobre las celdas verdes/
 *      amarillas para definir los slots.
 *   3. Si no se eligen candidatos, el heatmap queda vacío y el coordinador
 *      puede igual marcar slots libremente para crear un aula "placeholder".
 */

const DAYS_ES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
]

type Props = {
  programLevels: ProgramLevelOption[]
  weeklyMinHours: number
  weeklyMaxHours: number
}

type ProgramLevelGroup = {
  courseId: string
  courseName: string
  programs: {
    programId: string
    programName: string
    levels: ProgramLevelOption[]
  }[]
}

type CandidatesState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; error: string }
  | {
      kind: "ready"
      durationMinutes: number
      cefrLevelCode: string | null
      students: EligibleStudentCandidate[]
      teachers: EligibleTeacherCandidate[]
    }

export function NewClassGroupForm({
  programLevels,
  weeklyMinHours,
  weeklyMaxHours,
}: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [nameTouched, setNameTouched] = useState(false)
  const [candidates, setCandidates] = useState<CandidatesState>({ kind: "idle" })

  const grouped = useMemo(() => groupProgramLevels(programLevels), [programLevels])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    setValue,
    watch,
  } = useForm<NewClassGroupInput>({
    resolver: zodResolver(NewClassGroupSchema),
    defaultValues: {
      name: "",
      programLevelId: "",
      modality: Modality.VIRTUAL,
      slots: [],
      teacherId: undefined,
      enrollmentIds: [],
      notes: undefined,
    },
  })

  const watchedProgramLevelId = watch("programLevelId")
  const watchedSlots = watch("slots")
  const watchedTeacherId = watch("teacherId")
  const watchedEnrollmentIds = watch("enrollmentIds")
  const watchedModality = watch("modality")
  const watchedName = watch("name")

  const selectedLevel = programLevels.find((l) => l.id === watchedProgramLevelId)

  // Cargar candidatos al cambiar el nivel; resetear selecciones dependientes.
  useEffect(() => {
    if (!watchedProgramLevelId) {
      setCandidates({ kind: "idle" })
      return
    }
    setCandidates({ kind: "loading" })
    setValue("teacherId", undefined)
    setValue("enrollmentIds", [])
    setValue("slots", [])
    let cancelled = false
    loadAulaCandidates(watchedProgramLevelId).then((result) => {
      if (cancelled) return
      if (!result.success) {
        setCandidates({ kind: "error", error: result.error })
        return
      }
      setCandidates({
        kind: "ready",
        durationMinutes: result.durationMinutes,
        cefrLevelCode: result.cefrLevelCode,
        students: result.students,
        teachers: result.teachers,
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedProgramLevelId])

  // Heatmap derivado de selecciones + candidatos.
  const heatmap: Heatmap | null = useMemo(() => {
    if (candidates.kind !== "ready") return null
    const teacher = watchedTeacherId
      ? candidates.teachers.find((t) => t.id === watchedTeacherId)
      : null
    const students = watchedEnrollmentIds
      .map((id) => candidates.students.find((s) => s.enrollmentId === id))
      .filter((s): s is EligibleStudentCandidate => Boolean(s))
    return computeAvailabilityHeatmap({
      teacherAvailability: teacher ? teacher.availability : null,
      teacherConflicts: teacher ? teacher.conflicts : [],
      students: students.map((s) => ({
        enrollmentId: s.enrollmentId,
        fullName: s.fullName,
        preferredSchedule: s.preferredSchedule,
      })),
      durationMinutes: candidates.durationMinutes,
    })
  }, [candidates, watchedTeacherId, watchedEnrollmentIds])

  // Sugerencia de nombre en vivo (igual que antes).
  const suggestedName = useMemo(() => {
    if (!selectedLevel || watchedSlots.length === 0) return ""
    return generateClassGroupName({
      programName: selectedLevel.programName,
      levelCode: selectedLevel.code,
      levelName: selectedLevel.name,
      slots: watchedSlots,
    })
  }, [selectedLevel, watchedSlots])

  if (suggestedName && !nameTouched && watchedName !== suggestedName) {
    setValue("name", suggestedName)
  }

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const result = await createClassGroup(data)
      if (!result.success) {
        if (result.field) {
          setError(result.field, { type: "server", message: result.error })
        } else {
          setServerError(result.error)
        }
        return
      }
      router.push(`/admin/aulas/${result.classGroupId}` as Route)
    })
  })

  const ignoreTeacher = !watchedTeacherId

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos crear el aula"
          description={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      <Section title="Nivel y modalidad">
        <div className="grid gap-5 md:grid-cols-[2fr_1fr]">
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
            {selectedLevel && (
              <p className="mt-2 text-[12.5px] text-text-3">
                Duración por clase:{" "}
                <span className="font-mono text-foreground">
                  {selectedLevel.classDurationMinutes} min
                </span>
                {selectedLevel.cefrLevelCode && (
                  <>
                    {" · "}
                    CEFR{" "}
                    <span className="font-mono text-foreground">
                      {selectedLevel.cefrLevelCode}
                    </span>
                  </>
                )}
              </p>
            )}
          </Field>
          <Field id="modality" label="Modalidad" error={errors.modality?.message}>
            <ModalityPicker
              value={watchedModality}
              onChange={(m) =>
                setValue("modality", m, { shouldDirty: true, shouldValidate: true })
              }
            />
          </Field>
        </div>
      </Section>

      {/* Sección de candidatos — visible una vez elegido el nivel */}
      {watchedProgramLevelId && (
        <Section
          title="Candidatos"
          optional
          hint="Elegí docente y estudiantes para que el matchmaker te muestre los horarios que cuadran. Podés saltearlo y definir el horario manualmente."
        >
          {candidates.kind === "loading" && (
            <p className="inline-flex items-center gap-2 text-[13px] text-text-3">
              <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
              Buscando candidatos…
            </p>
          )}
          {candidates.kind === "error" && (
            <Alert variant="danger" title="No pudimos cargar candidatos">
              {candidates.error}
            </Alert>
          )}
          {candidates.kind === "ready" && (
            <div className="grid gap-5 md:grid-cols-2">
              <TeacherPicker
                teachers={candidates.teachers}
                cefrLevelCode={candidates.cefrLevelCode}
                value={watchedTeacherId}
                onChange={(id) =>
                  setValue("teacherId", id, { shouldValidate: true })
                }
              />
              <StudentPicker
                students={candidates.students}
                value={watchedEnrollmentIds}
                onChange={(ids) =>
                  setValue("enrollmentIds", ids, { shouldValidate: true })
                }
              />
            </div>
          )}
        </Section>
      )}

      {/* Sección de horario */}
      {watchedProgramLevelId && (
        <Section
          title="Horario semanal"
          hint={
            heatmap && (watchedTeacherId || watchedEnrollmentIds.length > 0)
              ? "Click sobre las celdas para elegir los slots. La duración la fija el nivel."
              : "Elegí celdas para definir el horario. Si todavía no marcaste docente o estudiantes, el heatmap está libre."
          }
        >
          {candidates.kind === "ready" && heatmap ? (
            <>
              <WeeklyLoadIndicator
                slotsCount={watchedSlots.length}
                durationMinutes={candidates.durationMinutes}
                minHours={weeklyMinHours}
                maxHours={weeklyMaxHours}
              />
              <MatchHeatmap
                heatmap={heatmap}
                selected={watchedSlots}
                onChange={(slots) =>
                  setValue("slots", slots, { shouldValidate: true })
                }
                ignoreTeacher={ignoreTeacher}
              />
              {watchedSlots.length > 0 && (
                <SelectedSlotsList
                  slots={watchedSlots}
                  durationMinutes={candidates.durationMinutes}
                  onRemove={(s) =>
                    setValue(
                      "slots",
                      watchedSlots.filter(
                        (x) => !(x.dayOfWeek === s.dayOfWeek && x.startTime === s.startTime),
                      ),
                      { shouldValidate: true },
                    )
                  }
                />
              )}
              {errors.slots && typeof errors.slots.message === "string" && (
                <p className="mt-2 text-[12.5px] text-danger">{errors.slots.message}</p>
              )}
            </>
          ) : (
            <p className="text-[13px] text-text-3">
              Esperando candidatos…
            </p>
          )}
        </Section>
      )}

      {/* Detalles del aula — visible una vez hay slots */}
      {watchedSlots.length > 0 && (
        <Section
          title="Detalles"
          hint="El link y la ubicación se heredan a cada clase y se incluyen en el correo de asignación que reciben docente y estudiantes."
        >
          <div className="space-y-4">
            <Field
              id="name"
              label="Nombre"
              optional
              error={errors.name?.message}
              hint={
                !nameTouched && suggestedName
                  ? "Generado automáticamente — podés editarlo"
                  : undefined
              }
            >
              <Input
                id="name"
                placeholder="Time Zones 2 · Mar-Jue 18:00"
                {...register("name", {
                  onChange: () => setNameTouched(true),
                })}
              />
            </Field>

            {(watchedModality === Modality.VIRTUAL ||
              watchedModality === Modality.HIBRIDO) && (
              <Field
                id="defaultMeetingUrl"
                label="Link de reunión"
                optional
                error={errors.defaultMeetingUrl?.message}
                hint="Lo carga el docente desde su panel cuando esté listo. Si ya lo tenés, pegalo acá."
              >
                <Input
                  id="defaultMeetingUrl"
                  type="url"
                  placeholder="https://meet.google.com/abc-defg-hij"
                  {...register("defaultMeetingUrl")}
                />
              </Field>
            )}

            {(watchedModality === Modality.PRESENCIAL ||
              watchedModality === Modality.HIBRIDO) && (
              <Field
                id="defaultLocation"
                label="Ubicación"
                error={errors.defaultLocation?.message}
              >
                <Input
                  id="defaultLocation"
                  placeholder="Av. Amazonas 1234, oficina 502"
                  {...register("defaultLocation")}
                />
              </Field>
            )}

            <Field id="notes" label="Notas internas" optional error={errors.notes?.message}>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Para uso de coordinación. No las ven el docente ni el estudiante."
                {...register("notes")}
              />
            </Field>
          </div>
        </Section>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isPending || watchedSlots.length === 0}
        >
          {isPending ? (
            <>
              <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
              Creando…
            </>
          ) : (
            "Crear aula"
          )}
        </Button>
      </div>
    </form>
  )
}

// -----------------------------------------------------------------------------
//  Pickers — docente y estudiantes
// -----------------------------------------------------------------------------

function TeacherPicker({
  teachers,
  cefrLevelCode,
  value,
  onChange,
}: {
  teachers: EligibleTeacherCandidate[]
  cefrLevelCode: string | null
  value: string | undefined
  onChange: (id: string | undefined) => void
}) {
  const matching = teachers.filter((t) => t.cefrMatch)
  const nonMatching = teachers.filter((t) => !t.cefrMatch)

  return (
    <div>
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
          Docente
        </h3>
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[11.5px] text-text-3 transition-colors hover:text-foreground"
          >
            Limpiar
          </button>
        )}
      </header>
      {teachers.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong bg-surface px-3 py-3 text-[12.5px] text-text-3">
          No hay docentes activos cargados.
        </p>
      ) : (
        <ul className="max-h-[260px] space-y-1.5 overflow-y-auto rounded-md border border-border bg-surface p-2">
          {matching.map((t) => (
            <li key={t.id}>
              <TeacherOption
                teacher={t}
                checked={value === t.id}
                onSelect={() => onChange(t.id)}
              />
            </li>
          ))}
          {nonMatching.length > 0 && cefrLevelCode && (
            <>
              <li className="px-1 pt-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-text-4">
                No cubren CEFR {cefrLevelCode}
              </li>
              {nonMatching.map((t) => (
                <li key={t.id}>
                  <TeacherOption
                    teacher={t}
                    checked={value === t.id}
                    onSelect={() => onChange(t.id)}
                    dimmed
                  />
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  )
}

function TeacherOption({
  teacher,
  checked,
  onSelect,
  dimmed,
}: {
  teacher: EligibleTeacherCandidate
  checked: boolean
  onSelect: () => void
  dimmed?: boolean
}) {
  return (
    <CheckLabel
      className={cn(
        "items-start gap-3 rounded-md border px-3 py-2 transition-colors",
        checked
          ? "border-teal-500 bg-teal-500/[0.06]"
          : "border-border bg-surface hover:border-border-strong",
        dimmed && "opacity-60",
      )}
    >
      <Radio
        name="teacherId"
        value={teacher.id}
        checked={checked}
        onChange={onSelect}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-foreground">
          {teacher.fullName}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-text-3">
          {teacher.email}
        </span>
        {teacher.conflicts.length > 0 && (
          <span className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-text-3">
            <Info size={11} strokeWidth={1.6} />
            Ya dicta {teacher.conflicts.length}{" "}
            {teacher.conflicts.length === 1 ? "bloque" : "bloques"} en otras aulas
          </span>
        )}
      </span>
    </CheckLabel>
  )
}

function StudentPicker({
  students,
  value,
  onChange,
}: {
  students: EligibleStudentCandidate[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id))
    } else {
      onChange([...value, id])
    }
  }

  return (
    <div>
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
          Estudiantes ({value.length}{value.length > 0 ? ` de ${students.length}` : ""})
        </h3>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11.5px] text-text-3 transition-colors hover:text-foreground"
          >
            Limpiar
          </button>
        )}
      </header>
      {students.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong bg-surface px-3 py-3 text-[12.5px] text-text-3">
          No hay estudiantes con matrícula activa para este nivel sin aula.
        </p>
      ) : (
        <ul className="max-h-[260px] space-y-1.5 overflow-y-auto rounded-md border border-border bg-surface p-2">
          {students.map((s) => {
            const noSchedule = s.preferredSchedule.length === 0
            return (
              <li key={s.enrollmentId}>
                <CheckLabel
                  className={cn(
                    "items-start gap-3 rounded-md border px-3 py-2 transition-colors",
                    value.includes(s.enrollmentId)
                      ? "border-teal-500 bg-teal-500/[0.06]"
                      : "border-border bg-surface hover:border-border-strong",
                  )}
                >
                  <Checkbox
                    checked={value.includes(s.enrollmentId)}
                    onChange={() => toggle(s.enrollmentId)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-foreground">
                      {s.fullName}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-text-3">
                      {s.email}
                    </span>
                    {noSchedule && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-warning">
                        <Info size={11} strokeWidth={1.6} />
                        Sin horario preferido cargado
                      </span>
                    )}
                  </span>
                </CheckLabel>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SelectedSlotsList({
  slots,
  durationMinutes,
  onRemove,
}: {
  slots: { dayOfWeek: number; startTime: string }[]
  durationMinutes: number
  onRemove: (s: { dayOfWeek: number; startTime: string }) => void
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
        Horario seleccionado:
      </span>
      {slots.map((s) => {
        const endTime = addMinutesToTime(s.startTime, durationMinutes)
        const dayLabel = DAYS_ES[s.dayOfWeek] ?? ""
        return (
          <button
            key={`${s.dayOfWeek}|${s.startTime}`}
            type="button"
            onClick={() => onRemove(s)}
            className="inline-flex items-center gap-1.5 rounded-md border border-teal-500/40 bg-teal-500/10 px-2 py-1 text-[12.5px] text-foreground transition-colors hover:border-danger/50 hover:bg-danger/10"
            aria-label={`Quitar ${dayLabel} ${s.startTime} a ${endTime}`}
          >
            <span>{dayLabel}</span>
            <span className="font-mono">
              {s.startTime} – {endTime}
            </span>
            <X size={11} strokeWidth={1.6} />
          </button>
        )
      })}
    </div>
  )
}

// -----------------------------------------------------------------------------
//  Sub-componentes UI
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
    <section className="rounded-xl border border-border bg-surface px-6 py-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-[20px] font-normal tracking-[-0.01em] text-foreground">
          {title}
        </h2>
        {optional && (
          <span className="text-[11px] uppercase tracking-[0.08em] text-text-4">
            opcional
          </span>
        )}
      </div>
      {hint && <p className="mb-4 max-w-[68ch] text-[13px] text-text-3">{hint}</p>}
      {children}
    </section>
  )
}

function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  optional?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {optional && <span className="text-[11px] text-text-4">opcional</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
      {!error && hint && <p className="mt-1.5 text-[12px] text-text-3">{hint}</p>}
    </div>
  )
}

function WeeklyLoadIndicator({
  slotsCount,
  durationMinutes,
  minHours,
  maxHours,
}: {
  slotsCount: number
  durationMinutes: number
  minHours: number
  maxHours: number
}) {
  const hours = (slotsCount * durationMinutes) / 60
  const inRange = hours >= minHours && hours <= maxHours
  const empty = slotsCount === 0
  const tone = empty
    ? "border-border bg-surface text-text-3"
    : inRange
      ? "border-teal-500/40 bg-teal-500/10 text-teal-700"
      : "border-warning/40 bg-warning/10 text-warning"
  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-baseline justify-between gap-2 rounded-md border px-3 py-2 text-[12.5px]",
        tone,
      )}
    >
      <span>
        Carga semanal:{" "}
        <span className="font-mono font-medium">{hours.toFixed(2)}h</span>
        <span className="ml-1 text-text-3">
          ({slotsCount} {slotsCount === 1 ? "clase" : "clases"} ×{" "}
          {durationMinutes} min)
        </span>
      </span>
      <span className="font-mono text-text-3">
        Rango permitido: {minHours}h – {maxHours}h
      </span>
    </div>
  )
}

function ModalityPicker({
  value,
  onChange,
}: {
  value: Modality
  onChange: (m: Modality) => void
}) {
  const options: { value: Modality; label: string }[] = [
    { value: Modality.VIRTUAL, label: "Virtual" },
    { value: Modality.PRESENCIAL, label: "Presencial" },
    { value: Modality.HIBRIDO, label: "Híbrida" },
  ]
  return (
    <div className="space-y-1.5">
      {options.map((opt) => (
        <CheckLabel
          key={opt.value}
          className={cn(
            "items-center gap-3 rounded-md border px-3 py-2 transition-colors",
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
          <span className="text-[13.5px] text-foreground">{opt.label}</span>
        </CheckLabel>
      ))}
    </div>
  )
}

function addMinutesToTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number]
  const total = h * 60 + m + minutes
  const eh = Math.floor(total / 60) % 24
  const em = total % 60
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`
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
