import Link from "next/link"
import type { Route } from "next"
import { ArrowRight, Calendar, ExternalLink, Users, Video } from "lucide-react"
import { Card, CardHeader, CardTitle, CardMeta } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * Agenda de hoy para el docente — espejo visual de `AgendaCard` admin
 * (design-mockups/Dashboard.html:1008-1078) pero con datos centrados en aulas.
 *
 * Cada fila: time mono · aula + programa · contador de alumnos · acción.
 * Status `live` resalta con tinte teal y dot pulsante.
 */

export type TeacherAgendaEntry = {
  id: string
  scheduledStart: Date
  scheduledEnd: Date
  classGroupId: string
  classGroupName: string
  programLabel: string
  modality: string
  meetingUrl: string | null
  location: string | null
  participantCount: number
  status: "live" | "scheduled" | "completed" | "cancelled" | "no_show"
}

const MODALITY_LABEL: Record<string, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrida",
}

const STATUS_LABEL: Record<TeacherAgendaEntry["status"], string> = {
  live: "En curso",
  scheduled: "Programada",
  completed: "Cerrada",
  cancelled: "Cancelada",
  no_show: "Sin registro",
}

export function TeacherAgendaCard({
  entries,
  totalToday,
}: {
  entries: TeacherAgendaEntry[]
  totalToday: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda de hoy</CardTitle>
        <CardMeta>
          {totalToday} {totalToday === 1 ? "clase" : "clases"}
        </CardMeta>
        <Link
          href={"/docente/clases" as Route}
          className="border-border-strong text-text-2 inline-flex items-center gap-1.5 border-b pb-px text-[13px] transition-colors hover:border-teal-500 hover:text-teal-500"
        >
          Ver todas
          <ArrowRight size={11} strokeWidth={1.6} />
        </Link>
      </CardHeader>
      <div>
        {entries.length === 0 ? (
          <p className="text-text-3 px-[22px] py-6 text-[13.5px]">
            Hoy no tienes clases programadas.
          </p>
        ) : (
          entries.map((c) => <ClassRow key={c.id} entry={c} />)
        )}
      </div>
    </Card>
  )
}

function ClassRow({ entry }: { entry: TeacherAgendaEntry }) {
  const isLive = entry.status === "live"
  const isScheduled = entry.status === "scheduled" || isLive
  const isVirtual = entry.modality === "VIRTUAL" || entry.modality === "HIBRIDO"
  const isPresencial = entry.modality === "PRESENCIAL" || entry.modality === "HIBRIDO"

  const showJoin = isScheduled && isVirtual && entry.meetingUrl
  const duration = Math.round(
    (entry.scheduledEnd.getTime() - entry.scheduledStart.getTime()) / 60_000,
  )

  return (
    <div
      className={cn(
        "border-border grid grid-cols-[92px_1fr_auto_auto] items-center gap-[18px] border-b px-[22px] py-3.5 transition-colors duration-[120ms]",
        "hover:bg-surface-alt last:border-b-0",
        isLive && "bg-teal-500/[0.05]",
      )}
    >
      {/* Time */}
      <div className="text-foreground font-mono text-[13px] leading-[1.3] tabular-nums">
        {formatTime(entry.scheduledStart)}
        <span className="text-text-3 mt-0.5 block text-[11px]">{duration} min</span>
      </div>

      {/* Aula + programa */}
      <div className="min-w-0">
        <div className="text-foreground flex items-center gap-2 text-[14.5px] leading-[1.3]">
          {isLive && <span aria-hidden className="live-dot" />}
          <Link
            href={`/docente/aulas/${entry.classGroupId}` as Route}
            className="truncate transition-colors hover:text-teal-500"
          >
            {entry.classGroupName}
          </Link>
        </div>
        <div className="text-text-3 mt-0.5 flex items-center gap-2 font-mono text-[12px] tracking-[0.02em]">
          <span className="truncate">{entry.programLabel}</span>
          <RowDot />
          <span>{MODALITY_LABEL[entry.modality] ?? entry.modality}</span>
          {!isScheduled && (
            <>
              <RowDot />
              <span>{STATUS_LABEL[entry.status]}</span>
            </>
          )}
          {isPresencial && entry.location && (
            <>
              <RowDot />
              <span className="truncate">{entry.location}</span>
            </>
          )}
        </div>
      </div>

      {/* Alumnos */}
      <div className="text-text-2 flex items-center gap-1.5 text-[12.5px]">
        <Users size={12} strokeWidth={1.6} className="text-text-3" />
        {entry.participantCount}
      </div>

      {/* Action */}
      <ActionButton entry={entry} showJoin={!!showJoin} />
    </div>
  )
}

function ActionButton({ entry, showJoin }: { entry: TeacherAgendaEntry; showJoin: boolean }) {
  if (showJoin && entry.meetingUrl) {
    return (
      <a
        href={entry.meetingUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="text-bone inline-flex items-center gap-1.5 rounded-md border border-teal-500 bg-teal-500 px-2.5 py-1.5 text-[12px] transition-colors duration-[120ms] hover:border-teal-700 hover:bg-teal-700"
      >
        <Video size={12} strokeWidth={1.6} />
        Unirse
        <ExternalLink size={10} strokeWidth={1.6} />
      </a>
    )
  }
  return (
    <Link
      href={`/docente/clases/${entry.id}` as Route}
      className="border-border text-text-2 inline-flex items-center gap-1.5 rounded-md border bg-transparent px-2.5 py-1.5 text-[12px] transition-colors duration-[120ms] hover:border-teal-500 hover:text-teal-500"
    >
      <Calendar size={12} strokeWidth={1.6} />
      Detalles
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
