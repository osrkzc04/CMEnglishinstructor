"use client"

import { useMemo, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, ArrowRight, Check, Copy, Loader2, Sparkles } from "lucide-react"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { finalizeManualReview } from "@/modules/tests/grading/manual-review.action"
import {
  ManualReviewInputSchema,
  type ManualReviewInput,
} from "@/modules/tests/grading/schemas"
import {
  PLACEMENT_SKILL_MAX,
  PLACEMENT_TOTAL_MAX,
  recommendPlacementLevel,
  type CefrLevelLite,
  type PlacementSectionSummary,
} from "@/modules/tests/grading/level-recommendation"

type Props = {
  sessionId: string
  isReviewed: boolean
  cefrLevels: CefrLevelLite[]
  // Resumen del adaptativo: qué bloques superó el candidato. Manda la
  // recomendación junto con el total.
  sectionSummaries: PlacementSectionSummary[]
  // Umbral global (%) para confirmar el nivel alcanzado.
  thresholdPercent: number
  // Puntaje sugerido para Reading/Grammar a partir de los aciertos
  // auto-calificados (sobre 100). Se usa como valor inicial editable.
  autoReadingSuggested: number | null
  initial: {
    reading: number | null
    writing: number | null
    listening: number | null
    speaking: number | null
    assignedLevelId: string | null
    reviewerNotes: string | null
    writingFeedback: string | null
  }
  resultsLink: string | null
  resultsExpiresAt: Date | null
}

const expiresFormatter = new Intl.DateTimeFormat("es-EC", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
})

function clampScore(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.min(PLACEMENT_SKILL_MAX, Math.max(0, n))
}

export function ReviewForm({
  sessionId,
  isReviewed,
  cefrLevels,
  sectionSummaries,
  thresholdPercent,
  autoReadingSuggested,
  initial,
  resultsLink,
  resultsExpiresAt,
}: Props) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    link: string
    expiresAt: Date | null
    emailQueued: boolean
  } | null>(
    resultsLink && resultsExpiresAt
      ? { link: resultsLink, expiresAt: resultsExpiresAt, emailQueued: false }
      : null,
  )
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Reading/Grammar se precarga con el valor ya guardado o, en su defecto,
  // con la sugerencia de los aciertos. Queda editable: coordinación puede
  // sobrescribirlo.
  const readingDefault = initial.reading ?? autoReadingSuggested ?? undefined

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ManualReviewInput>({
    resolver: zodResolver(ManualReviewInputSchema),
    defaultValues: {
      sessionId,
      reading: readingDefault,
      writing: initial.writing ?? undefined,
      listening: initial.listening ?? undefined,
      speaking: initial.speaking ?? undefined,
      assignedLevelId: initial.assignedLevelId ?? undefined,
      reviewerNotes: initial.reviewerNotes ?? undefined,
      writingFeedback: initial.writingFeedback ?? undefined,
    },
  })

  const watched = watch(["reading", "writing", "listening", "speaking"])
  const total = useMemo(
    () => watched.reduce((sum: number, v) => sum + clampScore(v), 0),
    [watched],
  )
  const recommendation = useMemo(
    () =>
      recommendPlacementLevel({
        sectionSummaries,
        total,
        thresholdPercent,
        cefrLevels,
      }),
    [sectionSummaries, total, thresholdPercent, cefrLevels],
  )
  const recommended = recommendation.recommendedLevel

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    startTransition(async () => {
      const response = await finalizeManualReview(data)
      if (!response.success) {
        setServerError(response.error)
        return
      }
      setFeedback({
        link: response.resultsLink,
        expiresAt: resultsExpiresAt,
        emailQueued: response.emailQueued,
      })
    })
  })

  async function copyLink() {
    if (!feedback) return
    try {
      await navigator.clipboard.writeText(feedback.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // noop
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <input type="hidden" {...register("sessionId")} value={sessionId} />

      {serverError && (
        <Alert
          variant="danger"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          title="No pudimos guardar la revisión"
          description={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      <div>
        <p className="text-text-3 mb-3 text-[13px] leading-[1.5]">
          Cada habilidad va sobre {PLACEMENT_SKILL_MAX}. El total se calcula sobre{" "}
          {PLACEMENT_TOTAL_MAX}.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="reading"
            label="Reading / Grammar"
            error={errors.reading?.message}
            hint={
              autoReadingSuggested !== null
                ? `Sugerido ${autoReadingSuggested}/100 según aciertos · editable`
                : undefined
            }
          >
            <Input
              id="reading"
              type="number"
              min={0}
              max={100}
              step="0.5"
              {...register("reading")}
            />
          </Field>
          <Field id="writing" label="Writing" error={errors.writing?.message}>
            <Input
              id="writing"
              type="number"
              min={0}
              max={100}
              step="0.5"
              {...register("writing")}
            />
          </Field>
          <Field id="listening" label="Listening" error={errors.listening?.message}>
            <Input
              id="listening"
              type="number"
              min={0}
              max={100}
              step="0.5"
              {...register("listening")}
            />
          </Field>
          <Field id="speaking" label="Speaking" error={errors.speaking?.message}>
            <Input
              id="speaking"
              type="number"
              min={0}
              max={100}
              step="0.5"
              {...register("speaking")}
            />
          </Field>
        </div>

        <div className="border-border mt-4 flex items-center justify-between rounded-lg border bg-surface-alt px-4 py-3">
          <span className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
            Total
          </span>
          <span className="text-foreground font-mono text-[18px] tabular-nums">
            {total} <span className="text-text-3 text-[13px]">/ {PLACEMENT_TOTAL_MAX}</span>
          </span>
        </div>
      </div>

      <Field
        id="writingFeedback"
        label="Retroalimentación del Writing"
        optional
        hint="La ve el candidato en su resultado y en el correo."
        error={errors.writingFeedback?.message}
      >
        <Textarea
          id="writingFeedback"
          rows={3}
          placeholder="Comentario sobre la redacción: estructura, gramática, vocabulario…"
          {...register("writingFeedback")}
        />
      </Field>

      <Field
        id="assignedLevelId"
        label="Nivel asignado"
        optional
        hint="Uso interno: no aparece en el correo de resultados."
        error={errors.assignedLevelId?.message}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] ${
              recommendation.isBelowThreshold
                ? "border-warning/40 bg-warning/[0.06] text-warning"
                : "border-border bg-surface-alt text-text-2"
            }`}
          >
            <Sparkles
              size={12}
              strokeWidth={1.7}
              className={recommendation.isBelowThreshold ? "text-warning" : "text-teal-500"}
            />
            {recommended ? (
              <>
                Sugerido: <span className="text-foreground font-medium">{recommended.code}</span> ·{" "}
                {recommended.name}
              </>
            ) : recommendation.reachedCode === null ? (
              "No superó ningún bloque — coordinación decide"
            ) : (
              `Por debajo del umbral en ${recommendation.reachedCode}, sin nivel inferior`
            )}
          </span>
          <span className="text-text-3 font-mono text-[11.5px] tabular-nums">
            {recommendation.totalPercent}% · umbral {recommendation.thresholdPercent}%
          </span>
          {recommended && (
            <button
              type="button"
              onClick={() => setValue("assignedLevelId", recommended.id, { shouldDirty: true })}
              className="text-teal-500 hover:text-teal-600 text-[12px] underline underline-offset-2"
            >
              Usar sugerencia
            </button>
          )}
        </div>
        <Select id="assignedLevelId" {...register("assignedLevelId")}>
          <option value="">— Sin asignar —</option>
          {cefrLevels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} · {l.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        id="reviewerNotes"
        label="Observaciones para el candidato"
        optional
        hint="Aparece en la pantalla de resultado del candidato."
        error={errors.reviewerNotes?.message}
      >
        <Textarea
          id="reviewerNotes"
          rows={4}
          placeholder="Fortalezas, áreas a reforzar, recomendación…"
          {...register("reviewerNotes")}
        />
      </Field>

      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <p className="text-text-3 text-[12.5px]">
          {isReviewed
            ? "Ya entregada. Al actualizar no se reenvía correo; el enlace no cambia."
            : "Al guardar se envía el correo con el enlace de resultado (vence en 12 h)."}
        </p>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isPending || (isReviewed && !isDirty)}
        >
          {isPending ? (
            <>
              <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
              Guardando…
            </>
          ) : isReviewed ? (
            <>
              Guardar cambios
              <ArrowRight size={14} strokeWidth={1.6} />
            </>
          ) : (
            <>
              Marcar como revisada
              <ArrowRight size={14} strokeWidth={1.6} />
            </>
          )}
        </Button>
      </div>

      {feedback && (
        <div className="mt-2 space-y-3 rounded-xl border border-teal-500/40 bg-teal-500/[0.06] p-5">
          <div>
            <p className="font-mono text-[11px] tracking-[0.08em] text-teal-500 uppercase">
              Resultado disponible
            </p>
            <p className="text-foreground mt-1 text-[13.5px] leading-[1.5]">
              {feedback.emailQueued
                ? "Enviamos el correo. Si no llega, comparte el enlace manualmente."
                : "El enlace está disponible. Cópialo y compártelo si lo necesitas."}
            </p>
          </div>
          <div className="border-border bg-surface flex items-start gap-3 rounded-md border p-3">
            <code className="text-foreground flex-1 font-mono text-[12.5px] leading-[1.5] break-all">
              {feedback.link}
            </code>
            <button
              type="button"
              onClick={copyLink}
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
          {feedback.expiresAt && (
            <p className="text-text-3 font-mono text-[11.5px] tracking-[0.02em]">
              El enlace vence el {expiresFormatter.format(feedback.expiresAt)}
            </p>
          )}
        </div>
      )}
    </form>
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
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {optional && <span className="text-text-4 text-[11px]">opcional</span>}
      </div>
      {children}
      {hint && <p className="text-text-3 mt-1 text-[12px] leading-[1.45]">{hint}</p>}
      {error && <p className="text-danger mt-1 text-[12px]">{error}</p>}
    </div>
  )
}
