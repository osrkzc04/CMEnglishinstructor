"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { ArrowRight, CheckCircle2, Loader2, PenLine } from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/layout/BrandMark"
import { Button } from "@/components/ui/button"
import { RichPrompt } from "@/components/ui/rich-prompt"
import { TimerDisplay } from "./TimerDisplay"

/**
 * Pantalla de redacción del placement adaptativo. Se muestra cuando la
 * sesión está en PENDING_WRITING — el motor ya cerró las preguntas de MC
 * y ahora pide la consigna escrita del nivel que el candidato alcanzó.
 *
 * El reloj global sigue corriendo (mismo deadline del examen); si el
 * candidato no envía a tiempo, el lazy expire / cron lo marcan TIMED_OUT
 * preservando el response parcial.
 *
 * Validación cliente mínima — el servidor también valida longitud.
 */

const MIN_CHARS = 1
const MAX_CHARS = 8000

type Props = {
  token: string
  sessionId: string
  candidateName: string
  deadlineISO: string
  remainingMs: number
  syncedAtMs: number
  writingLevelCode: string | null
  writingPromptSnapshot: string | null
  initialResponse: string | null
}

export function WritingScreen({
  token,
  sessionId,
  candidateName,
  deadlineISO,
  remainingMs,
  syncedAtMs,
  writingLevelCode,
  writingPromptSnapshot,
  initialResponse,
}: Props) {
  const router = useRouter()
  const [response, setResponse] = useState<string>(initialResponse ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedLength = response.trim().length
  const canSubmit = trimmedLength >= MIN_CHARS && trimmedLength <= MAX_CHARS && !submitting

  async function onSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/test-sessions/${sessionId}/submit-writing`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response }),
      })
      if (res.ok) {
        router.replace(`/prueba/${token}/finalizado` as Route)
        return
      }
      if (res.status === 410) {
        router.replace(`/prueba/${token}/finalizado` as Route)
        return
      }
      if (res.status === 423) {
        router.refresh()
        return
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      setError(translateWritingError(body))
    } catch {
      setError("No pudimos enviar tu redacción. Revisa tu conexión y reintenta.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="bg-background min-h-screen pb-20">
      <header className="border-border bg-surface sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMark className="text-foreground" size={22} />
            <BrandWordmark className="text-foreground" size="sm" />
          </div>
          <div className="text-text-3 hidden text-[12.5px] sm:block">{candidateName}</div>
          <TimerDisplay
            deadlineISO={deadlineISO}
            syncedAtMs={syncedAtMs}
            remainingMs={remainingMs}
          />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-start gap-3">
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-teal-500/[0.1] text-teal-500">
            <PenLine size={18} strokeWidth={1.7} />
          </span>
          <div>
            <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
              Redacción {writingLevelCode ? `· ${writingLevelCode}` : ""}
            </p>
            <h1 className="text-foreground mt-1 font-serif text-[26px] leading-[1.2] font-normal tracking-[-0.02em]">
              Última parte: escribe tu redacción
            </h1>
            <p className="text-text-3 mt-2 text-[13.5px] leading-[1.55]">
              Lee la instrucción y desarróllala en el espacio de abajo. Una vez enviada, la
              evaluación quedará lista para revisión.
            </p>
          </div>
        </div>

        <section className="border-border bg-surface rounded-xl border p-6">
          <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
            Instrucción
          </p>
          {writingPromptSnapshot ? (
            <RichPrompt
              content={writingPromptSnapshot}
              className="text-foreground mt-3 font-serif text-[16px]"
            />
          ) : (
            <p className="text-text-4 mt-3 italic">Sin instrucción configurada.</p>
          )}
        </section>

        <section className="mt-6">
          <label
            htmlFor="writing-response"
            className="text-text-3 mb-2 block font-mono text-[11px] tracking-[0.08em] uppercase"
          >
            Tu respuesta
          </label>
          <textarea
            id="writing-response"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={14}
            disabled={submitting}
            placeholder="Escribe aquí tu redacción…"
            className="border-border bg-surface text-foreground placeholder:text-text-4 block w-full resize-y rounded-lg border px-4 py-3 text-[14px] leading-[1.6] focus:border-teal-500 focus:outline-none disabled:opacity-60"
            aria-invalid={!!error || undefined}
          />
          <div className="text-text-3 mt-2 flex items-center justify-between text-[11.5px]">
            <span>
              {trimmedLength === 0
                ? "Escribe al menos una oración."
                : `${trimmedLength} caracteres`}
            </span>
            {trimmedLength > MAX_CHARS && (
              <span className="text-danger">
                Superas el máximo permitido de {MAX_CHARS} caracteres.
              </span>
            )}
          </div>
        </section>

        {error && (
          <p
            className="text-danger border-danger/30 bg-danger/[0.06] mt-4 rounded-md border px-3 py-2 text-[13px]"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="border-border mt-6 flex justify-end border-t pt-6">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <>
                <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                Enviar y finalizar evaluación
                <CheckCircle2 size={14} strokeWidth={1.6} />
                <ArrowRight size={14} strokeWidth={1.6} />
              </>
            )}
          </Button>
        </div>
      </div>
    </main>
  )
}

function translateWritingError(body: { error?: string; message?: string }): string {
  if (body.error === "invalid_state") {
    return body.message ?? "Tu respuesta no se pudo guardar tal cual."
  }
  if (body.error === "device_mismatch") {
    return "La evaluación se está usando desde otro dispositivo."
  }
  if (body.error === "invalid_body") {
    return "El texto no es válido. Revisa que no esté vacío."
  }
  return "No pudimos enviar tu redacción. Reintenta en un momento."
}
