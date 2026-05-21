"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, ArrowRight, History, Loader2, Plus, Trash2 } from "lucide-react"
import { QuestionType } from "@prisma/client"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox, CheckLabel, Radio } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  NewQuestionSchema,
  UpdateQuestionSchema,
  type NewQuestionInput,
  type UpdateQuestionInput,
} from "@/modules/questions/schemas"
import { createQuestion } from "@/modules/questions/create.action"
import { updateQuestion } from "@/modules/questions/update.action"

/**
 * Form de alta/edición de pregunta. Cliente.
 *
 * Comparte estructura para crear y editar:
 *  - `mode: "create"` arranca limpio con 4 opciones MC vacías por default.
 *  - `mode: "edit"` recibe `initial` con la pregunta cargada (incluye id +
 *    opciones existentes + flag `hasBeenUsed` para mostrar banner).
 *
 * Reglas de UX:
 *  - El nivel viene fijado por la URL; lo mostramos en read-only.
 *  - Switch MC ↔ FILL_IN solo afecta qué sección rendereamos. Los arrays
 *    "del otro tipo" quedan en state pero la action solo envía el branch
 *    elegido.
 *  - Antes de descartar cambios al cancelar avisamos solo si el form está
 *    dirty (TODO menor, no bloquea la etapa).
 */

const LETTERS = ["A", "B", "C", "D", "E", "F"] as const

type Mode = "create" | "edit"

type FormShape = {
  id?: string
  levelId: string
  prompt: string
  type: QuestionType
  topic?: string
  points: number
  options: { text: string; isCorrect: boolean }[]
  acceptedAnswers: { answer: string; caseSensitive: boolean }[]
}

type Props = {
  mode: Mode
  level: { id: string; code: string; name: string }
  initial?: {
    id: string
    prompt: string
    type: QuestionType
    topic: string | null
    points: number
    options: { text: string; isCorrect: boolean }[]
    acceptedAnswers: { answer: string; caseSensitive: boolean }[]
    hasBeenUsed: boolean
  }
  cancelHref: Route
}

const emptyMcOptions: { text: string; isCorrect: boolean }[] = [
  { text: "", isCorrect: true },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
]

const emptyFillAnswers: { answer: string; caseSensitive: boolean }[] = [
  { answer: "", caseSensitive: false },
]

export function QuestionForm({ mode, level, initial, cancelHref }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const defaultValues: FormShape =
    mode === "edit" && initial
      ? {
          id: initial.id,
          levelId: level.id,
          prompt: initial.prompt,
          type: initial.type,
          topic: initial.topic ?? undefined,
          points: initial.points,
          options:
            initial.options.length > 0
              ? initial.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }))
              : emptyMcOptions,
          acceptedAnswers:
            initial.acceptedAnswers.length > 0
              ? initial.acceptedAnswers.map((a) => ({
                  answer: a.answer,
                  caseSensitive: a.caseSensitive,
                }))
              : emptyFillAnswers,
        }
      : {
          levelId: level.id,
          prompt: "",
          type: QuestionType.MULTIPLE_CHOICE,
          topic: undefined,
          points: 1,
          options: emptyMcOptions,
          acceptedAnswers: emptyFillAnswers,
        }

  const schema = mode === "edit" ? UpdateQuestionSchema : NewQuestionSchema
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormShape>({
    resolver: zodResolver(schema as never),
    defaultValues: defaultValues as never,
  })

  const watchedType = watch("type")

  const optionsArray = useFieldArray({ control, name: "options" })
  const answersArray = useFieldArray({ control, name: "acceptedAnswers" })

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const response =
        mode === "edit"
          ? await updateQuestion(data as UpdateQuestionInput)
          : await createQuestion(data as NewQuestionInput)
      if (!response.success) {
        setServerError(response.error)
        return
      }
      router.push(cancelHref)
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos guardar la pregunta"
          description={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      {mode === "edit" && initial?.hasBeenUsed && (
        <div className="border-warning/40 bg-warning/[0.06] flex items-start gap-3 rounded-xl border px-4 py-3">
          <History size={16} strokeWidth={1.7} className="text-warning mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-foreground text-[13.5px] font-medium">
              Esta pregunta ya se usó en evaluaciones
            </p>
            <p className="text-text-3 mt-1 text-[12.5px] leading-[1.5]">
              Tu edición no modifica los intentos pasados — esos quedaron snapshoteados al rendir.
              Los cambios se aplican a partir de los próximos sorteos.
            </p>
          </div>
        </div>
      )}

      <Section title="Información">
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field id="prompt-level" label="Nivel CEFR">
            <div className="border-border bg-surface-alt text-text-2 inline-flex items-center gap-2 rounded-md border px-3.5 py-2.5 text-[14px]">
              <span className="text-foreground font-medium">{level.code}</span>
              <span className="text-text-3 text-[12.5px]">· {level.name}</span>
            </div>
          </Field>
          <Field id="points" label="Puntos" hint="Default 1">
            <Input id="points" type="number" min={1} max={10} {...register("points")} />
          </Field>
        </div>
      </Section>

      <Section title="Tipo de pregunta">
        <div className="grid gap-2 sm:grid-cols-2">
          <TypeChoice
            value={QuestionType.MULTIPLE_CHOICE}
            label="Opción múltiple"
            hint="El candidato elige una entre varias alternativas."
            checked={watchedType === QuestionType.MULTIPLE_CHOICE}
            onSelect={() => setValue("type", QuestionType.MULTIPLE_CHOICE, { shouldDirty: true })}
          />
          <TypeChoice
            value={QuestionType.FILL_IN}
            label="Completar"
            hint="El candidato escribe la respuesta. Se compara contra una lista de aceptadas."
            checked={watchedType === QuestionType.FILL_IN}
            onSelect={() => setValue("type", QuestionType.FILL_IN, { shouldDirty: true })}
          />
        </div>
      </Section>

      <Section title="Enunciado">
        <Field id="prompt" label="Texto que ve el candidato" error={errors.prompt?.message}>
          <Textarea
            id="prompt"
            rows={3}
            placeholder="Ej. Choose the correct option to complete the sentence: She ___ a book."
            {...register("prompt")}
          />
        </Field>
        <Field id="topic" label="Tópico" optional error={errors.topic?.message}>
          <Input
            id="topic"
            placeholder="Ej. grammar, vocabulary, reading…"
            {...register("topic")}
          />
        </Field>
      </Section>

      {watchedType === QuestionType.MULTIPLE_CHOICE ? (
        <Section
          title="Opciones de respuesta"
          hint="Marca al menos una opción como correcta. Mínimo 2, máximo 6."
        >
          <div className="space-y-2">
            {optionsArray.fields.map((field, idx) => {
              const letter = LETTERS[idx] ?? String(idx + 1)
              const fieldError = errors.options?.[idx]
              return (
                <div
                  key={field.id}
                  className="border-border bg-surface flex items-start gap-3 rounded-md border px-3 py-2.5"
                >
                  <span className="border-border bg-surface-alt text-text-3 mt-1.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-md border font-mono text-[12px] font-medium">
                    {letter}
                  </span>
                  <div className="flex-1 space-y-1.5">
                    <Input
                      placeholder={`Texto de la opción ${letter}`}
                      {...register(`options.${idx}.text`)}
                    />
                    {fieldError?.text && (
                      <p className="text-danger text-[11.5px]">{fieldError.text.message}</p>
                    )}
                  </div>
                  <CheckLabel className="mt-2.5 gap-2">
                    <Checkbox {...register(`options.${idx}.isCorrect`)} />
                    <span className="text-[12.5px]">Correcta</span>
                  </CheckLabel>
                  <button
                    type="button"
                    aria-label="Eliminar opción"
                    disabled={optionsArray.fields.length <= 2}
                    onClick={() => optionsArray.remove(idx)}
                    className="text-text-3 hover:text-danger disabled:text-text-4 mt-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={14} strokeWidth={1.6} />
                  </button>
                </div>
              )
            })}
            {typeof errors.options?.message === "string" && (
              <p className="text-danger mt-1 text-[12.5px]">{errors.options.message}</p>
            )}
            <button
              type="button"
              onClick={() => optionsArray.append({ text: "", isCorrect: false })}
              disabled={optionsArray.fields.length >= 6}
              className="border-border bg-surface text-text-2 inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-[12.5px] transition-colors hover:border-teal-500 hover:text-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={12} strokeWidth={1.8} />
              Agregar opción
            </button>
          </div>
        </Section>
      ) : (
        <Section
          title="Respuestas aceptadas"
          hint="Cualquiera de estas se considera correcta. Si marcas 'sensible a mayúsculas', la respuesta tiene que coincidir tal cual con esa entrada."
        >
          <div className="space-y-2">
            {answersArray.fields.map((field, idx) => {
              const fieldError = errors.acceptedAnswers?.[idx]
              return (
                <div
                  key={field.id}
                  className="border-border bg-surface flex items-start gap-3 rounded-md border px-3 py-2.5"
                >
                  <span className="border-border bg-surface-alt text-text-3 mt-1.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-md border font-mono text-[12px] font-medium">
                    {idx + 1}
                  </span>
                  <div className="flex-1 space-y-1.5">
                    <Input placeholder="Ej. went" {...register(`acceptedAnswers.${idx}.answer`)} />
                    {fieldError?.answer && (
                      <p className="text-danger text-[11.5px]">{fieldError.answer.message}</p>
                    )}
                  </div>
                  <CheckLabel className="mt-2.5 gap-2">
                    <Checkbox {...register(`acceptedAnswers.${idx}.caseSensitive`)} />
                    <span className="text-[12.5px]">Aa sensible</span>
                  </CheckLabel>
                  <button
                    type="button"
                    aria-label="Eliminar respuesta"
                    disabled={answersArray.fields.length <= 1}
                    onClick={() => answersArray.remove(idx)}
                    className="text-text-3 hover:text-danger disabled:text-text-4 mt-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={14} strokeWidth={1.6} />
                  </button>
                </div>
              )
            })}
            {typeof errors.acceptedAnswers?.message === "string" && (
              <p className="text-danger mt-1 text-[12.5px]">{errors.acceptedAnswers.message}</p>
            )}
            <button
              type="button"
              onClick={() => answersArray.append({ answer: "", caseSensitive: false })}
              disabled={answersArray.fields.length >= 6}
              className="border-border bg-surface text-text-2 inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-[12.5px] transition-colors hover:border-teal-500 hover:text-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={12} strokeWidth={1.8} />
              Agregar respuesta
            </button>
          </div>
        </Section>
      )}

      <div className="border-border flex items-center justify-end gap-3 border-t pt-5">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => router.push(cancelHref)}
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
            <>
              {mode === "edit" ? "Guardar cambios" : "Crear pregunta"}
              <ArrowRight size={14} strokeWidth={1.6} />
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

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
        <p className="text-text-3 mt-1 mb-4 text-[12.5px] leading-[1.5]">{hint}</p>
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
  hint,
  optional,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  optional?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {optional && <span className="text-text-4 text-[11px]">opcional</span>}
      </div>
      {children}
      {hint && <p className="text-text-3 text-[11.5px] leading-[1.45]">{hint}</p>}
      {error && <p className="text-danger text-[12px]">{error}</p>}
    </div>
  )
}

function TypeChoice({
  value,
  label,
  hint,
  checked,
  onSelect,
}: {
  value: QuestionType
  label: string
  hint: string
  checked: boolean
  onSelect: () => void
}) {
  return (
    <CheckLabel
      className={cn(
        "items-start gap-3 rounded-md border px-4 py-3 transition-colors",
        checked
          ? "border-teal-500 bg-teal-500/[0.06]"
          : "border-border bg-surface hover:border-border-strong",
      )}
    >
      <Radio name="type" value={value} checked={checked} onChange={onSelect} />
      <span>
        <span className="text-foreground block text-[14px] font-medium">{label}</span>
        <span className="text-text-3 mt-0.5 block text-[12px] leading-[1.5]">{hint}</span>
      </span>
    </CheckLabel>
  )
}
