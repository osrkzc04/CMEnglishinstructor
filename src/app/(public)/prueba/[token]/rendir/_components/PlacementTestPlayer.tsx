"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/layout/BrandMark"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TimerDisplay } from "./TimerDisplay"
import { CardGrid, type CardState, type SectionRange } from "./CardGrid"
import { QuestionView, type QuestionOption } from "./QuestionView"

/**
 * Orquestador principal de la pantalla `/prueba/[token]/rendir`.
 *
 * Maneja:
 *  - Estado local de respuestas (espejo del servidor, auto-save con debounce).
 *  - Navegación entre tarjetas dentro de la sección actual.
 *  - Botón "Continuar" gateado por todas las preguntas respondidas.
 *  - Llamada a `advance-section` que refresca el estado con la siguiente
 *    sección o redirige a `/finalizado`.
 *  - Eventos anti-trampa (focus / paste / copy) — no bloquean.
 *  - Re-sync del reloj con el servidor en cada respuesta guardada.
 */

type VisibleQuestion = {
  order: number
  prompt: string
  type: "MULTIPLE_CHOICE" | "FILL_IN"
  options: QuestionOption[] | null
  selectedOptionId: string | null
  textAnswer: string | null
  markedForReview: boolean
}

type SectionMeta = {
  order: number
  isUnlocked: boolean
  isCurrent: boolean
  totalQuestions: number
  answeredQuestions: number
  cardRange: { start: number; end: number } | null
}

export type SessionState = {
  sessionId: string
  status: "IN_PROGRESS" | "SUBMITTED" | "TIMED_OUT" | "REVIEWED" | "ABANDONED"
  candidateName: string
  deadlineISO: string
  remainingMs: number
  currentSectionOrder: number
  visibleQuestions: VisibleQuestion[]
  sections: SectionMeta[]
}

const SAVE_DEBOUNCE_MS = 500

export function PlacementTestPlayer({
  token,
  initialState,
}: {
  token: string
  initialState: SessionState
}) {
  const router = useRouter()
  const [state, setState] = useState<SessionState>(initialState)
  const [syncedAtMs, setSyncedAtMs] = useState<number>(Date.now())
  const [activeOrder, setActiveOrder] = useState<number>(
    initialState.visibleQuestions[0]?.order ?? 1,
  )
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [advanceError, setAdvanceError] = useState<string | null>(null)
  const saveTimers = useRef<Map<number, number>>(new Map())

  // -----------------------------------------------------------------------
  //  Anti-cheat hooks — registran eventos sin bloquear.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (state.status !== "IN_PROGRESS") return
    const post = (type: string, metadata?: Record<string, unknown>) => {
      void fetch(`/api/test-sessions/${state.sessionId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, metadata }),
      }).catch(() => {})
    }
    const onBlur = () => post("FOCUS_LOST")
    const onFocus = () => post("FOCUS_REGAINED")
    const onCopy = () => post("COPY_ATTEMPT")
    const onPaste = () => post("PASTE_ATTEMPT")
    const onVis = () => post(document.hidden ? "FOCUS_LOST" : "FOCUS_REGAINED")
    window.addEventListener("blur", onBlur)
    window.addEventListener("focus", onFocus)
    document.addEventListener("copy", onCopy)
    document.addEventListener("paste", onPaste)
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.removeEventListener("blur", onBlur)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("copy", onCopy)
      document.removeEventListener("paste", onPaste)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [state.status, state.sessionId])

  // -----------------------------------------------------------------------
  //  Map de questionOrder → tarjeta global. Calculado desde sections.
  // -----------------------------------------------------------------------
  const cardByOrder = useMemo(() => {
    const m = new Map<number, number>()
    for (const sec of state.sections) {
      if (!sec.cardRange) continue
      const sectionQuestions = state.visibleQuestions
        .filter((q) => sec.isCurrent)
        .map((q) => q.order)
      // Solo la sección actual aparece en visibleQuestions; las anteriores
      // están bloqueadas y se muestran como tarjetas-fantasma. Para mapearlas
      // bien usamos el rango.
      if (sec.isCurrent) {
        sectionQuestions.forEach((order, idx) => {
          m.set(order, sec.cardRange!.start + idx)
        })
      }
    }
    return m
  }, [state.sections, state.visibleQuestions])

  const sectionRanges: SectionRange[] = state.sections.map((s) => ({
    order: s.order,
    isCurrent: s.isCurrent,
    isUnlocked: s.isUnlocked,
    cardRange: s.cardRange,
    totalQuestions: s.totalQuestions,
    answeredQuestions: s.answeredQuestions,
  }))

  const cards: CardState[] = useMemo(() => {
    const out: CardState[] = []
    for (const sec of state.sections) {
      if (!sec.isUnlocked || !sec.cardRange) continue
      // Para la sección actual: usar visibleQuestions con su estado real.
      if (sec.isCurrent) {
        state.visibleQuestions.forEach((q, idx) => {
          const isAnswered =
            q.type === "MULTIPLE_CHOICE"
              ? q.selectedOptionId !== null
              : q.textAnswer !== null && q.textAnswer.trim().length > 0
          out.push({
            globalNumber: sec.cardRange!.start + idx,
            questionOrder: q.order,
            isAnswered,
            isMarkedForReview: q.markedForReview,
            isCurrent: q.order === activeOrder,
            isLocked: false,
          })
        })
      } else {
        // Sección anterior: tarjetas-fantasma marcadas como respondidas y locked.
        for (let i = 0; i < sec.totalQuestions; i++) {
          out.push({
            globalNumber: sec.cardRange.start + i,
            questionOrder: -1, // sin questionOrder real — locked, no clickable.
            isAnswered: true,
            isMarkedForReview: false,
            isCurrent: false,
            isLocked: true,
          })
        }
      }
    }
    return out
  }, [state.sections, state.visibleQuestions, activeOrder])

  const currentSection = state.sections.find((s) => s.isCurrent)
  const totalInCurrentSection = currentSection?.totalQuestions ?? 0
  const answeredInCurrent = currentSection?.answeredQuestions ?? 0
  const remainingInCurrent = Math.max(0, totalInCurrentSection - answeredInCurrent)
  const allAnswered = answeredInCurrent >= totalInCurrentSection && totalInCurrentSection > 0

  const activeQuestion = state.visibleQuestions.find((q) => q.order === activeOrder) ?? null
  const activeIndex = state.visibleQuestions.findIndex((q) => q.order === activeOrder)
  const globalActiveNumber = cardByOrder.get(activeOrder) ?? activeIndex + 1

  // Primera pregunta sin responder en la sección — alimenta el atajo
  // "Ir a la siguiente sin responder" cuando el candidato aún no terminó.
  const firstUnansweredOrder = useMemo(() => {
    for (const q of state.visibleQuestions) {
      const isAnswered =
        q.type === "MULTIPLE_CHOICE"
          ? q.selectedOptionId !== null
          : q.textAnswer !== null && q.textAnswer.trim().length > 0
      if (!isAnswered) return q.order
    }
    return null
  }, [state.visibleQuestions])

  // -----------------------------------------------------------------------
  //  Auto-save por respuesta con debounce 500 ms (por questionOrder).
  // -----------------------------------------------------------------------
  const saveAnswer = useCallback(
    (questionOrder: number, partial: Partial<VisibleQuestion>) => {
      const q = state.visibleQuestions.find((x) => x.order === questionOrder)
      const payload = {
        questionOrder,
        selectedOptionId: partial.selectedOptionId ?? q?.selectedOptionId ?? null,
        textAnswer: partial.textAnswer ?? q?.textAnswer ?? null,
        markedForReview: partial.markedForReview ?? q?.markedForReview ?? false,
      }
      // Optimistic local update.
      setState((prev) => {
        const visible = prev.visibleQuestions.map((vq) =>
          vq.order === questionOrder ? { ...vq, ...partial } : vq,
        )
        // Recalcular answeredQuestions de la sección actual.
        const sections = prev.sections.map((s) => {
          if (!s.isCurrent) return s
          const answered = visible.filter((vq) =>
            vq.type === "MULTIPLE_CHOICE"
              ? vq.selectedOptionId !== null
              : vq.textAnswer !== null && vq.textAnswer.trim().length > 0,
          ).length
          return { ...s, answeredQuestions: answered }
        })
        return { ...prev, visibleQuestions: visible, sections }
      })

      // Debounce per question.
      const existing = saveTimers.current.get(questionOrder)
      if (existing) window.clearTimeout(existing)
      const timer = window.setTimeout(() => {
        void fetch(`/api/test-sessions/${state.sessionId}/answer`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }).then(async (res) => {
          if (res.ok) {
            const body = (await res.json()) as { remainingMs: number }
            setSyncedAtMs(Date.now())
            setState((prev) => ({ ...prev, remainingMs: body.remainingMs }))
          } else if (res.status === 410) {
            router.replace(`/prueba/${token}/finalizado` as Route)
          }
        })
      }, SAVE_DEBOUNCE_MS)
      saveTimers.current.set(questionOrder, timer)
    },
    [state.visibleQuestions, state.sessionId, router, token],
  )

  // -----------------------------------------------------------------------
  //  Navegación
  // -----------------------------------------------------------------------
  function selectByOrder(order: number) {
    if (order < 0) return
    setActiveOrder(order)
  }
  function gotoPrev() {
    if (activeIndex > 0) setActiveOrder(state.visibleQuestions[activeIndex - 1]!.order)
  }
  function gotoNext() {
    if (activeIndex < state.visibleQuestions.length - 1) {
      setActiveOrder(state.visibleQuestions[activeIndex + 1]!.order)
    }
  }

  // -----------------------------------------------------------------------
  //  Continue → POST /advance-section
  // -----------------------------------------------------------------------
  async function onContinue() {
    if (!allAnswered || isAdvancing) return
    setIsAdvancing(true)
    setAdvanceError(null)
    try {
      const res = await fetch(`/api/test-sessions/${state.sessionId}/advance-section`, {
        method: "POST",
      })
      if (!res.ok) {
        if (res.status === 410) {
          router.replace(`/prueba/${token}/finalizado` as Route)
          return
        }
        if (res.status === 423) {
          router.refresh()
          return
        }
        const body = (await res.json()) as { error?: string }
        setAdvanceError(translateAdvanceError(body.error))
        return
      }
      const body = (await res.json()) as
        | { ok: true; advanced: true; nextSectionOrder: number }
        | { ok: true; advanced: false; status: "SUBMITTED" | "TIMED_OUT"; reason: string }
      if (!body.advanced) {
        router.replace(`/prueba/${token}/finalizado` as Route)
        return
      }
      // Refrescar estado pidiendo el nuevo snapshot al server.
      const stateRes = await fetch(`/api/test-sessions/${state.sessionId}/state`)
      if (!stateRes.ok) {
        router.refresh()
        return
      }
      const stateBody = (await stateRes.json()) as { ok: true; state: SessionState }
      setState(stateBody.state)
      setSyncedAtMs(Date.now())
      setActiveOrder(stateBody.state.visibleQuestions[0]?.order ?? 1)
    } catch {
      setAdvanceError("No pudimos continuar. Revisa tu conexión y reintenta.")
    } finally {
      setIsAdvancing(false)
    }
  }

  return (
    <main className="bg-background min-h-screen pb-20">
      <header className="border-border bg-surface sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMark className="text-foreground" size={22} />
            <BrandWordmark className="text-foreground" size="sm" />
          </div>
          <div className="text-text-3 hidden text-[12.5px] sm:block">{state.candidateName}</div>
          <TimerDisplay
            deadlineISO={state.deadlineISO}
            syncedAtMs={syncedAtMs}
            remainingMs={state.remainingMs}
          />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_280px]">
        <section>
          {activeQuestion ? (
            <>
              <QuestionView
                globalNumber={globalActiveNumber}
                totalInSection={totalInCurrentSection}
                prompt={activeQuestion.prompt}
                type={activeQuestion.type}
                options={activeQuestion.options}
                selectedOptionId={activeQuestion.selectedOptionId}
                textAnswer={activeQuestion.textAnswer}
                markedForReview={activeQuestion.markedForReview}
                onSelectOption={(id) =>
                  saveAnswer(activeOrder, { selectedOptionId: id, textAnswer: null })
                }
                onChangeText={(v) =>
                  saveAnswer(activeOrder, { textAnswer: v, selectedOptionId: null })
                }
                onToggleReview={() =>
                  saveAnswer(activeOrder, {
                    markedForReview: !activeQuestion.markedForReview,
                  })
                }
              />

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={gotoPrev}
                    disabled={activeIndex === 0}
                  >
                    <ArrowLeft size={14} strokeWidth={1.6} />
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={gotoNext}
                    disabled={activeIndex === state.visibleQuestions.length - 1}
                  >
                    Siguiente pregunta
                    <ArrowRight size={14} strokeWidth={1.6} />
                  </Button>
                </div>

                {allAnswered ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={onContinue}
                    disabled={isAdvancing}
                  >
                    {isAdvancing ? (
                      <>
                        <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
                        Procesando…
                      </>
                    ) : (
                      <>
                        Continuar a la siguiente sección
                        <CheckCircle2 size={14} strokeWidth={1.6} />
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="border-warning/40 bg-warning/[0.06] flex items-center gap-3 rounded-md border px-3 py-2">
                    <span className="text-text-2 text-[12.5px]">
                      Faltan{" "}
                      <strong className="text-foreground tabular-nums">{remainingInCurrent}</strong>{" "}
                      {remainingInCurrent === 1 ? "pregunta" : "preguntas"} para continuar
                    </span>
                    {firstUnansweredOrder !== null && firstUnansweredOrder !== activeOrder && (
                      <button
                        type="button"
                        onClick={() => selectByOrder(firstUnansweredOrder)}
                        className="text-[12.5px] font-medium text-teal-500 underline-offset-2 hover:text-teal-700 hover:underline"
                      >
                        Ir a la siguiente sin responder →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {advanceError && (
                <p className="text-danger mt-3 text-right text-[12.5px]">{advanceError}</p>
              )}
            </>
          ) : (
            <p className="text-text-3">Cargando preguntas…</p>
          )}
        </section>

        <aside className={cn("lg:sticky lg:top-[68px] lg:self-start")}>
          <CardGrid sections={sectionRanges} cards={cards} onSelect={selectByOrder} />
        </aside>
      </div>
    </main>
  )
}

function translateAdvanceError(code: string | undefined): string {
  switch (code) {
    case "section_incomplete":
      return "Aún quedan preguntas sin responder."
    case "device_mismatch":
      return "La evaluación se está usando desde otro dispositivo."
    case "invalid_state":
      return "La evaluación ya no admite cambios."
    default:
      return "No pudimos avanzar. Reintenta en un momento."
  }
}
