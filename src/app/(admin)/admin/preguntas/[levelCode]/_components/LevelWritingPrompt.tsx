"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, PenLine } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { RichPromptEditor } from "@/components/ui/rich-prompt-editor"
import { updateWritingPrompts } from "@/modules/tests/templates/update-writing-prompts.action"

/**
 * Editor de la consigna de redacción (writing) para un nivel CEFR concreto.
 * Vive al pie de la página del nivel en el banco de evaluación: así todo lo
 * de un nivel —preguntas y consigna— se administra en un solo lugar.
 *
 * Reusa la action `updateWritingPrompts` enviando una sola sección. El
 * snapshot lo hace el motor al presentar la consigna al candidato, por eso
 * editar acá no afecta exámenes ya rendidos.
 */

type Props = {
  templateId: string
  sectionId: string
  levelCode: string
  passingPercent: number
  initialPrompt: string | null
}

export function LevelWritingPrompt({
  templateId,
  sectionId,
  levelCode,
  passingPercent,
  initialPrompt,
}: Props) {
  const router = useRouter()
  const [value, setValue] = useState(initialPrompt ?? "")
  const [serverError, setServerError] = useState<string | null>(null)
  const [savedOk, setSavedOk] = useState(false)
  const [isPending, startTransition] = useTransition()

  const dirty = value.trim() !== (initialPrompt ?? "").trim()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerError(null)
    setSavedOk(false)
    startTransition(async () => {
      try {
        const response = await updateWritingPrompts({
          templateId,
          sections: [{ sectionId, writingPrompt: value }],
        })
        if (!response.success) {
          setServerError(response.error)
          return
        }
        setSavedOk(true)
        router.refresh()
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido"
        setServerError(`No se pudo contactar al servidor. ${msg}`)
      }
    })
  }

  return (
    <section className="border-border bg-surface mt-6 rounded-xl border p-6">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-teal-500/[0.1] text-teal-500">
            <PenLine size={16} strokeWidth={1.7} />
          </span>
          <div>
            <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
              Redacción · {levelCode}
            </p>
            <h2 className="text-foreground mt-0.5 font-serif text-[18px] font-normal tracking-[-0.01em]">
              Instrucción de redacción
            </h2>
          </div>
        </div>
        <span className="text-text-3 font-mono text-[11.5px] tabular-nums">
          Umbral {passingPercent}%
        </span>
      </header>

      <p className="text-text-3 mb-4 max-w-2xl text-[12.5px] leading-[1.5]">
        Esta instrucción se le muestra al candidato cuando {levelCode} es el último bloque que
        alcanza (sea por llegar al final o por no superar el umbral en este nivel). Los cambios se
        aplican a las próximas evaluaciones.
      </p>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {serverError && (
          <Alert
            variant="danger"
            icon={<AlertTriangle size={16} strokeWidth={1.6} />}
            title="No pudimos guardar la instrucción"
            description={serverError}
            onDismiss={() => setServerError(null)}
          />
        )}

        {savedOk && (
          <Alert
            variant="teal"
            icon={<CheckCircle2 size={16} strokeWidth={1.6} />}
            title="Instrucción guardada"
            description="Las próximas evaluaciones usarán este texto."
            onDismiss={() => setSavedOk(false)}
          />
        )}

        <RichPromptEditor
          id={`writing-${sectionId}`}
          value={value}
          onChange={(next) => {
            setValue(next)
            if (savedOk) setSavedOk(false)
          }}
          placeholder="Escribe la instrucción. Usa la barra (o Ctrl+B / Ctrl+I) para resaltar el enunciado y el texto guía."
          rows={8}
        />

        <div className="flex items-center justify-end">
          <Button type="submit" variant="primary" size="md" disabled={isPending || !dirty}>
            {isPending ? (
              <>
                <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                Guardar instrucción
                <ArrowRight size={14} strokeWidth={1.6} />
              </>
            )}
          </Button>
        </div>
      </form>
    </section>
  )
}
