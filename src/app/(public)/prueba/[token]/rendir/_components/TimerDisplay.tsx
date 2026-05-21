"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Timer cosmético — calcula localmente `deadline - now()` y se refresca cada
 * segundo. La fuente de verdad es el servidor; cada respuesta refresca
 * `remainingMs` y reseteamos el reloj local con ese valor para corregir drift.
 */
export function TimerDisplay({
  deadlineISO,
  syncedAtMs,
  remainingMs,
}: {
  deadlineISO: string
  syncedAtMs: number
  remainingMs: number
}) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const elapsed = Date.now() - syncedAtMs
  const ms = Math.max(0, remainingMs - elapsed)
  const totalSec = Math.floor(ms / 1000)
  const mm = Math.floor(totalSec / 60)
  const ss = totalSec % 60

  const isLow = ms < 5 * 60_000
  const isCritical = ms < 60_000

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[14px] tabular-nums",
        isCritical
          ? "border-danger/50 bg-danger/[0.08] text-danger"
          : isLow
            ? "border-warning/50 bg-warning/[0.08] text-warning"
            : "border-border bg-surface text-text-2",
      )}
      aria-live="polite"
      aria-label={`Tiempo restante: ${mm} minutos ${ss} segundos`}
      title={`Deadline ${new Date(deadlineISO).toLocaleTimeString()}`}
    >
      <Clock size={13} strokeWidth={1.6} />
      <span>
        {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
      </span>
    </div>
  )
}
