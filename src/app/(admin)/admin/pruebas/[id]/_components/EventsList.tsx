import { cn } from "@/lib/utils"
import type { ReviewEvent } from "@/modules/tests/sessions/review-queries"

/**
 * Eventos sospechosos registrados durante la sesión (focus_lost, copy/paste,
 * intentos de cambiar dispositivo, etc). El detalle queda crudo para que
 * coordinación tenga el contexto sin que el motor decida nada.
 */

const SUSPICIOUS = new Set([
  "FOCUS_LOST",
  "FULLSCREEN_EXIT",
  "COPY_ATTEMPT",
  "PASTE_ATTEMPT",
  "DEVICE_MISMATCH",
  "SECTION_LOCKED",
])

const LABELS: Record<string, string> = {
  FOCUS_LOST: "Salió de la pestaña",
  FOCUS_REGAINED: "Volvió a la pestaña",
  FULLSCREEN_EXIT: "Salió de pantalla completa",
  COPY_ATTEMPT: "Intento de copiar",
  PASTE_ATTEMPT: "Intento de pegar",
  SESSION_RESUMED: "Retomó sesión",
  QUESTION_VIEWED: "Vio pregunta",
  SECTION_ADVANCED: "Avanzó de bloque",
  SECTION_LOCKED: "Cierre por umbral",
  DEVICE_MISMATCH: "Intento desde otro dispositivo",
}

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "America/Guayaquil",
})

export function EventsList({ events }: { events: ReviewEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="border-border bg-surface rounded-xl border p-5">
        <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">Eventos</p>
        <p className="text-text-3 mt-2 text-[13px]">No se registraron eventos durante la sesión.</p>
      </div>
    )
  }

  return (
    <div className="border-border bg-surface space-y-3 rounded-xl border p-5">
      <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
        Eventos durante la sesión
      </p>
      <ol className="space-y-1.5">
        {events.map((e) => {
          const isSuspicious = SUSPICIOUS.has(e.type)
          return (
            <li
              key={e.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-[12.5px]",
                isSuspicious
                  ? "border-warning/40 bg-warning/[0.06]"
                  : "border-border bg-surface-alt",
              )}
            >
              <span className="text-text-2 font-mono tabular-nums">
                {dateFormatter.format(e.occurredAt)}
              </span>
              <span
                className={cn(
                  "flex-1 text-[13px]",
                  isSuspicious ? "text-warning" : "text-foreground",
                )}
              >
                {LABELS[e.type] ?? e.type}
              </span>
              {hasMetadata(e.metadata) && (
                <span className="text-text-3 max-w-[260px] truncate font-mono text-[11px]">
                  {summarizeMetadata(e.metadata)}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function hasMetadata(metadata: unknown): boolean {
  return metadata !== null && typeof metadata === "object" && Object.keys(metadata).length > 0
}

function summarizeMetadata(metadata: unknown): string {
  if (metadata === null || typeof metadata !== "object") return ""
  try {
    return Object.entries(metadata as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(" · ")
  } catch {
    return ""
  }
}
