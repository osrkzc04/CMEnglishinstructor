import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReviewEvent } from "@/modules/tests/sessions/review-queries"

/**
 * Eventos registrados durante la sesión (focus_lost, copy/paste, vistas de
 * pregunta, etc). Como eventos como QUESTION_VIEWED pueden ser cientos, la
 * vista por defecto agrupa por tipo con su conteo —los sospechosos primero y
 * resaltados— y la cronología cruda queda detrás de un desplegable. El motor
 * no decide nada: coordinación lee el contexto.
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

  const summary = summarizeEvents(events)

  return (
    <div className="border-border bg-surface space-y-3 rounded-xl border p-5">
      <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
        Eventos durante la sesión
      </p>

      <ul className="space-y-1.5">
        {summary.map((g) => (
          <li
            key={g.type}
            className={cn(
              "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-[13px]",
              g.suspicious ? "border-warning/40 bg-warning/[0.06]" : "border-border bg-surface-alt",
            )}
          >
            <span className={g.suspicious ? "text-warning" : "text-foreground"}>
              {LABELS[g.type] ?? g.type}
            </span>
            <span className="text-text-3 font-mono text-[12px] tabular-nums">×{g.count}</span>
          </li>
        ))}
      </ul>

      <details className="group">
        <summary className="text-text-3 hover:text-foreground flex cursor-pointer list-none items-center gap-1.5 font-mono text-[11px] tracking-[0.02em] transition-colors [&::-webkit-details-marker]:hidden">
          <ChevronDown
            size={13}
            strokeWidth={1.7}
            className="transition-transform group-open:rotate-180"
            aria-hidden
          />
          Ver cronología ({events.length})
        </summary>
        <ol className="mt-2 space-y-1.5">
          {events.map((e) => {
            const isSuspicious = SUSPICIOUS.has(e.type)
            return (
              <li
                key={e.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-[12.5px]",
                  isSuspicious ? "border-warning/40 bg-warning/[0.06]" : "border-border bg-surface-alt",
                )}
              >
                <span className="text-text-2 font-mono tabular-nums">
                  {dateFormatter.format(e.occurredAt)}
                </span>
                <span
                  className={cn("flex-1 text-[13px]", isSuspicious ? "text-warning" : "text-foreground")}
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
      </details>
    </div>
  )
}

type EventGroup = { type: string; count: number; suspicious: boolean }

function summarizeEvents(events: ReviewEvent[]): EventGroup[] {
  const counts = new Map<string, number>()
  for (const e of events) counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count, suspicious: SUSPICIOUS.has(type) }))
    .sort((a, b) => {
      // Sospechosos primero; dentro de cada grupo, los más frecuentes arriba.
      if (a.suspicious !== b.suspicious) return a.suspicious ? -1 : 1
      return b.count - a.count
    })
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
