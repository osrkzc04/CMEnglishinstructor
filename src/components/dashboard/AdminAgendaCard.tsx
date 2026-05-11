import Link from "next/link"
import type { Route } from "next"
import { ArrowRight, Calendar, Users } from "lucide-react"
import { Card, CardHeader, CardTitle, CardMeta } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

/**
 * Agenda de hoy para el admin — espejo del componente original AgendaCard
 * pero adaptado a datos reales:
 *
 *   - Acepta estados `live`, `scheduled`, `completed`, `cancelled`, `no_show`
 *     con tratamiento visual distinto (muted/strikethrough en cerradas).
 *   - El "primaryLabel" es el estudiante (1-a-1) o el nombre del aula.
 *   - La acción siempre lleva a `/admin/aulas/[id]` (drill-down al detalle del
 *     aula que dictará/dictó la clase).
 */

export type AdminAgendaEntryView = {
  id: string
  scheduledStart: Date
  scheduledEnd: Date
  classGroupId: string
  primaryLabel: string
  programLabel: string
  cefrLevelCode: string | null
  modality: string
  teacherInitials: string
  teacherName: string
  status: "live" | "scheduled" | "completed" | "cancelled" | "no_show"
  participantCount: number
}

const MODALITY_LABEL: Record<string, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrida",
}

const STATUS_LABEL: Record<AdminAgendaEntryView["status"], string> = {
  live: "En curso",
  scheduled: "Programada",
  completed: "Cerrada",
  cancelled: "Cancelada",
  no_show: "Sin registro",
}

export function AdminAgendaCard({
  entries,
  totalToday,
  totalTeachers,
}: {
  entries: AdminAgendaEntryView[]
  totalToday: number
  totalTeachers: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda de hoy</CardTitle>
        <CardMeta>
          {totalToday} {totalToday === 1 ? "clase" : "clases"} · {totalTeachers}{" "}
          {totalTeachers === 1 ? "docente" : "docentes"}
        </CardMeta>
        <Link
          href={"/admin/clases" as Route}
          className="border-border-strong text-text-2 inline-flex items-center gap-1.5 border-b pb-px text-[13px] transition-colors hover:border-teal-500 hover:text-teal-500"
        >
          Ver agenda completa
          <ArrowRight size={11} strokeWidth={1.6} />
        </Link>
      </CardHeader>
      <div>
        {entries.length === 0 ? (
          <p className="text-text-3 px-[22px] py-6 text-[13.5px]">
            Hoy no hay clases programadas en ninguna aula.
          </p>
        ) : (
          entries.map((e) => <ClassRow key={e.id} entry={e} />)
        )}
      </div>
    </Card>
  )
}

function ClassRow({ entry }: { entry: AdminAgendaEntryView }) {
  const isLive = entry.status === "live"
  const isFinished =
    entry.status === "completed" || entry.status === "cancelled" || entry.status === "no_show"
  const duration = Math.round(
    (entry.scheduledEnd.getTime() - entry.scheduledStart.getTime()) / 60_000,
  )

  return (
    <Link
      href={`/admin/aulas/${entry.classGroupId}` as Route}
      className={cn(
        "border-border grid grid-cols-[92px_1fr_auto_auto] items-center gap-[18px] border-b px-[22px] py-3.5 transition-colors duration-[120ms]",
        "hover:bg-surface-alt last:border-b-0",
        isLive && "bg-teal-500/[0.05]",
        entry.status === "cancelled" && "opacity-55",
      )}
    >
      <div className="text-foreground font-mono text-[13px] leading-[1.3] tabular-nums">
        {formatTime(entry.scheduledStart)}
        <span className="text-text-3 mt-0.5 block text-[11px]">{duration} min</span>
      </div>

      <div className="min-w-0">
        <div className="text-foreground flex items-center gap-2 text-[14.5px] leading-[1.3]">
          {isLive && <span aria-hidden className="live-dot" />}
          <span className="truncate">{entry.primaryLabel}</span>
        </div>
        <div className="text-text-3 mt-0.5 flex items-center gap-2 font-mono text-[12px] tracking-[0.02em]">
          {entry.cefrLevelCode && <span>{entry.cefrLevelCode}</span>}
          {entry.cefrLevelCode && <RowDot />}
          <span className="truncate">{entry.programLabel}</span>
          <RowDot />
          <span>{MODALITY_LABEL[entry.modality] ?? entry.modality}</span>
          {isFinished && (
            <>
              <RowDot />
              <span>{STATUS_LABEL[entry.status]}</span>
            </>
          )}
        </div>
      </div>

      <div className="text-text-2 flex items-center gap-2 text-[13px]">
        <Avatar size="sm" initials={entry.teacherInitials} />
        <span className="hidden sm:inline">{entry.teacherName}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-text-3 inline-flex items-center gap-1 font-mono text-[11.5px]">
          <Users size={11} strokeWidth={1.6} />
          {entry.participantCount}
        </span>
        <span className="border-border text-text-2 inline-flex items-center gap-1.5 rounded-md border bg-transparent px-2.5 py-1.5 text-[12px] transition-colors hover:border-teal-500 hover:text-teal-500">
          <Calendar size={12} strokeWidth={1.6} />
          Detalles
        </span>
      </div>
    </Link>
  )
}

function RowDot() {
  return <span aria-hidden className="bg-text-4 inline-block h-[3px] w-[3px] rounded-full" />
}

const timeFormatter = new Intl.DateTimeFormat("es-EC", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Guayaquil",
})

function formatTime(d: Date): string {
  return timeFormatter.format(d)
}
