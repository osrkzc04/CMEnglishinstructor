import Link from "next/link"
import type { Route } from "next"
import { ArrowRight, ChevronRight } from "lucide-react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * Pendientes del docente — espejo de `PendingsCard` admin pero con razones
 * adecuadas al rol: clase en curso, sin cerrar, o falta registro.
 *
 * Layout: grid 4-col → indicador iniciales · aula+programa+horario · pill ·
 * chevron. Click manda al detalle de la sesión donde puede cerrar / cargar
 * bitácora.
 */

export type TeacherPendingEntry = {
  id: string
  classGroupId: string
  classGroupName: string
  programLabel: string
  scheduledStart: Date
  scheduledEnd: Date
  /**
   *  live      → ahora mismo
   *  overdue   → pasó el horario, sigue abierta
   *  missing   → bitácora o asistencia falta
   */
  reason: "live" | "overdue" | "missing"
}

const REASON_LABEL: Record<TeacherPendingEntry["reason"], string> = {
  live: "En curso",
  overdue: "Por cerrar",
  missing: "Falta registro",
}

export function TeacherPendingsCard({ items }: { items: TeacherPendingEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pendientes</CardTitle>
        <Link
          href={"/docente/clases" as Route}
          className="border-border-strong text-text-2 inline-flex items-center gap-1.5 border-b pb-px text-[13px] transition-colors hover:border-teal-500 hover:text-teal-500"
        >
          Ir a clases
          <ArrowRight size={11} strokeWidth={1.6} />
        </Link>
      </CardHeader>
      <div>
        {items.length === 0 ? (
          <p className="text-text-3 px-[22px] py-6 text-[13.5px]">
            Estás al día. Sin clases por cerrar.
          </p>
        ) : (
          items.map((p) => <PendingRow key={p.id} item={p} />)
        )}
      </div>
    </Card>
  )
}

function PendingRow({ item }: { item: TeacherPendingEntry }) {
  return (
    <Link
      href={`/docente/clases/${item.id}` as Route}
      className="group border-border hover:bg-surface-alt grid grid-cols-[36px_1fr_auto_auto] items-center gap-3.5 border-b px-[22px] py-3.5 transition-colors duration-[120ms] last:border-b-0"
    >
      <div className="border-border bg-bone-50 text-text-2 grid h-8 w-8 place-items-center rounded-md border font-mono text-[12px] tracking-[0.02em]">
        {initials(item.classGroupName)}
      </div>
      <div className="min-w-0">
        <div className="text-foreground truncate text-[14px] leading-[1.3]">
          {item.classGroupName}
        </div>
        <div className="text-text-3 mt-0.5 truncate font-mono text-[12px] tracking-[0.02em]">
          {item.programLabel}
        </div>
        <div className="text-text-3 mt-0.5 font-mono text-[11.5px] tracking-[0.02em]">
          {formatDateShort(item.scheduledStart)} · {formatTime(item.scheduledStart)}–
          {formatTime(item.scheduledEnd)}
        </div>
      </div>
      <ReasonPill reason={item.reason} />
      <span className="text-text-4 transition-colors group-hover:text-teal-500">
        <ChevronRight size={14} strokeWidth={1.6} />
      </span>
    </Link>
  )
}

function ReasonPill({ reason }: { reason: TeacherPendingEntry["reason"] }) {
  return (
    <span
      className={cn(
        "rounded-sm border px-2 py-[3px] font-mono text-[11px] leading-[1.4] tracking-[0.06em] uppercase",
        reason === "live" && "border-teal-500/35 bg-teal-500/[0.07] text-teal-500",
        reason === "overdue" && "border-warning/35 bg-warning/[0.07] text-warning",
        reason === "missing" && "border-info/35 bg-info/[0.07] text-info",
      )}
    >
      {REASON_LABEL[reason]}
    </span>
  )
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "—"
  if (parts.length === 1) {
    return (parts[0]?.slice(0, 2) ?? "").toUpperCase()
  }
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

const dateShortFormatter = new Intl.DateTimeFormat("es-EC", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "America/Guayaquil",
})

const timeFormatter = new Intl.DateTimeFormat("es-EC", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Guayaquil",
})

function formatDateShort(d: Date): string {
  return dateShortFormatter.format(d).replace(/\./g, "")
}

function formatTime(d: Date): string {
  return timeFormatter.format(d)
}
