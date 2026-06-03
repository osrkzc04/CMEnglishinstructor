import { PenLine } from "lucide-react"
import { RichPrompt } from "@/components/ui/rich-prompt"

/**
 * Card de revisión del writing del placement adaptativo. Visible cuando la
 * sesión tiene `writingPromptSnapshot` (siempre, una vez que el motor
 * decidió cerrar). Si `writingResponse` aún es null la mostramos con
 * estado "pendiente" — el candidato puede haber cerrado el navegador en
 * PENDING_WRITING sin enviar.
 *
 * La calificación numérica (writing 0-100) se sigue ingresando en el
 * formulario lateral (`PlacementSkillEvaluation.writing`). Acá solo
 * exponemos prompt + respuesta para que coordinación los lea.
 */

type Props = {
  writingLevelCode: string | null
  writingPromptSnapshot: string | null
  writingResponse: string | null
  writingSubmittedAt: Date | null
  sessionStatus:
    | "IN_PROGRESS"
    | "PENDING_WRITING"
    | "SUBMITTED"
    | "TIMED_OUT"
    | "REVIEWED"
    | "ABANDONED"
}

const dateFmt = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
})

export function WritingReviewCard({
  writingLevelCode,
  writingPromptSnapshot,
  writingResponse,
  writingSubmittedAt,
  sessionStatus,
}: Props) {
  if (!writingPromptSnapshot) return null

  const hasResponse = writingResponse !== null && writingResponse.trim().length > 0
  const pending = sessionStatus === "PENDING_WRITING" && !hasResponse
  const partial =
    (sessionStatus === "TIMED_OUT" || sessionStatus === "ABANDONED") && !hasResponse

  return (
    <section className="border-border bg-surface rounded-xl border p-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-teal-500/[0.1] text-teal-500">
            <PenLine size={16} strokeWidth={1.7} />
          </span>
          <div>
            <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
              Redacción {writingLevelCode ? `· ${writingLevelCode}` : ""}
            </p>
            <h2 className="text-foreground mt-1 font-serif text-[20px] font-normal tracking-[-0.01em]">
              Writing del candidato
            </h2>
          </div>
        </div>
        {writingSubmittedAt && (
          <p className="text-text-3 font-mono text-[11px] tabular-nums">
            {dateFmt.format(writingSubmittedAt)}
          </p>
        )}
      </header>

      <div className="space-y-4">
        <div>
          <p className="text-text-3 mb-2 font-mono text-[11px] tracking-[0.08em] uppercase">
            Instrucción
          </p>
          <div className="border-border bg-surface-alt rounded-md border px-4 py-3">
            <RichPrompt
              content={writingPromptSnapshot}
              className="text-foreground text-[14px]"
            />
          </div>
        </div>

        <div>
          <p className="text-text-3 mb-2 font-mono text-[11px] tracking-[0.08em] uppercase">
            Respuesta
          </p>
          {hasResponse ? (
            <div className="border-border bg-surface-alt rounded-md border px-4 py-3">
              <p className="text-foreground text-[14px] leading-[1.65] whitespace-pre-line">
                {writingResponse}
              </p>
              <p className="text-text-3 mt-3 font-mono text-[11px]">
                {writingResponse!.trim().length} caracteres ·{" "}
                {writingResponse!.trim().split(/\s+/).filter(Boolean).length} palabras
              </p>
            </div>
          ) : pending ? (
            <div className="border-info/30 bg-info/[0.06] rounded-md border px-4 py-3">
              <p className="text-text-2 text-[13px]">
                El candidato aún no ha enviado la redacción. La sesión está en pausa esperando
                su envío.
              </p>
            </div>
          ) : partial ? (
            <div className="border-warning/40 bg-warning/[0.06] rounded-md border px-4 py-3">
              <p className="text-text-2 text-[13px]">
                Se mostró la instrucción al candidato, pero la sesión cerró antes de recibir
                respuesta.
              </p>
            </div>
          ) : (
            <p className="text-text-4 text-[13.5px] italic">Sin respuesta registrada.</p>
          )}
        </div>
      </div>
    </section>
  )
}
