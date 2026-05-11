import Link from "next/link"
import type { Route } from "next"
import { ArrowRight, Calendar, ExternalLink, MapPin, Video } from "lucide-react"
import { Card, CardHeader, CardTitle, CardMeta } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

/**
 * Agenda próxima del estudiante — espejo visual de `TeacherAgendaCard` pero
 * con el docente como contexto principal (avatar + nombre) en la columna
 * derecha. Cada fila linkea a `/estudiante/clases` (no hay detalle por
 * sesión del lado estudiante).
 */

export type StudentAgendaEntry = {
  id: string
  scheduledStart: Date
  scheduledEnd: Date
  classGroupId: string
  classGroupName: string
  modality: string
  meetingUrl: string | null
  location: string | null
  teacherName: string | null
  status: "live" | "scheduled"
}

const MODALITY_LABEL: Record<string, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrida",
}

export function StudentAgendaCard({
  entries,
  totalToday,
}: {
  entries: StudentAgendaEntry[]
  totalToday: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tu agenda</CardTitle>
        <CardMeta>
          {totalToday > 0
            ? `${totalToday} ${totalToday === 1 ? "clase hoy" : "clases hoy"}`
            : "Próximos 7 días"}
        </CardMeta>
        <Link
          href={"/estudiante/clases" as Route}
          className="border-border-strong text-text-2 inline-flex items-center gap-1.5 border-b pb-px text-[13px] transition-colors hover:border-teal-500 hover:text-teal-500"
        >
          Ver todas
          <ArrowRight size={11} strokeWidth={1.6} />
        </Link>
      </CardHeader>
      <div>
        {entries.length === 0 ? (
          <p className="text-text-3 px-[22px] py-6 text-[13.5px]">
            No hay clases programadas en los próximos días.
          </p>
        ) : (
          entries.map((c) => <ClassRow key={c.id} entry={c} />)
        )}
      </div>
    </Card>
  )
}

function ClassRow({ entry }: { entry: StudentAgendaEntry }) {
  const isLive = entry.status === "live"
  const isVirtual = entry.modality === "VIRTUAL" || entry.modality === "HIBRIDO"
  const isPresencial = entry.modality === "PRESENCIAL" || entry.modality === "HIBRIDO"
  const showJoin = isVirtual && entry.meetingUrl

  return (
    <div
      className={cn(
        "border-border grid grid-cols-[92px_1fr_auto_auto] items-center gap-[18px] border-b px-[22px] py-3.5 transition-colors duration-[120ms]",
        "hover:bg-surface-alt last:border-b-0",
        isLive && "bg-teal-500/[0.05]",
      )}
    >
      <div className="text-foreground font-mono text-[13px] leading-[1.3] tabular-nums">
        {formatTime(entry.scheduledStart)}
        <span className="text-text-3 mt-0.5 block text-[11px]">
          {formatDayShort(entry.scheduledStart)}
        </span>
      </div>

      <div className="min-w-0">
        <div className="text-foreground flex items-center gap-2 text-[14.5px] leading-[1.3]">
          {isLive && <span aria-hidden className="live-dot" />}
          <span className="truncate">{entry.classGroupName}</span>
        </div>
        <div className="text-text-3 mt-0.5 flex items-center gap-2 font-mono text-[12px] tracking-[0.02em]">
          <span>{MODALITY_LABEL[entry.modality] ?? entry.modality}</span>
          {isPresencial && entry.location && (
            <>
              <RowDot />
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin size={10} strokeWidth={1.6} />
                <span className="truncate">{entry.location}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {entry.teacherName ? (
        <div className="text-text-2 flex items-center gap-2 text-[13px]">
          <Avatar size="sm" initials={initials(entry.teacherName)} />
          <span className="truncate">{entry.teacherName}</span>
        </div>
      ) : (
        <span className="text-text-3 text-[12px]">Sin docente</span>
      )}

      <ActionButton entry={entry} showJoin={!!showJoin} />
    </div>
  )
}

function ActionButton({ entry, showJoin }: { entry: StudentAgendaEntry; showJoin: boolean }) {
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
    <span className="border-border text-text-3 inline-flex items-center gap-1.5 rounded-md border bg-transparent px-2.5 py-1.5 text-[12px]">
      <Calendar size={12} strokeWidth={1.6} />
      Programada
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

function RowDot() {
  return <span aria-hidden className="bg-text-4 inline-block h-[3px] w-[3px] rounded-full" />
}

const timeFormatter = new Intl.DateTimeFormat("es-EC", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Guayaquil",
})

const dayShortFormatter = new Intl.DateTimeFormat("es-EC", {
  weekday: "short",
  day: "2-digit",
  timeZone: "America/Guayaquil",
})

function formatTime(d: Date): string {
  return timeFormatter.format(d)
}

function formatDayShort(d: Date): string {
  return dayShortFormatter.format(d).replace(/\./g, "")
}
