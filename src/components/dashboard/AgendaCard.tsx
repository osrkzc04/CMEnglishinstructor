import Link from "next/link"
import type { Route } from "next"
import { ArrowRight, Calendar, Eye, Video } from "lucide-react"
import { Card, CardHeader, CardTitle, CardMeta } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

/**
 * Agenda de hoy — design-mockups/Dashboard.html:1008-1078.
 *
 * Card con lista de filas de clase. Cada row: time mono · who (student + meta)
 * · teacher · acción. Variante `live` con bg teal-tint y dot pulsante.
 */

export type ClassEntry = {
  id: string
  time: string
  duration: string
  student: string
  level: string
  program: string
  modality: string
  teacherInitials: string
  teacherName: string
  status: "live" | "scheduled"
  action: "join" | "observe" | "details"
}

export function AgendaCard({
  entries,
  totalToday,
  totalTeachers,
}: {
  entries: ClassEntry[]
  totalToday: number
  totalTeachers: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda de hoy</CardTitle>
        <CardMeta>{totalToday} clases · {totalTeachers} docentes</CardMeta>
        <Link
          href={"/admin/clases" as Route}
          className="inline-flex items-center gap-1.5 border-b border-border-strong pb-px text-[13px] text-text-2 transition-colors hover:border-teal-500 hover:text-teal-500"
        >
          Ver agenda completa
          <ArrowRight size={11} strokeWidth={1.6} />
        </Link>
      </CardHeader>
      <div>
        {entries.map((c) => (
          <ClassRow key={c.id} entry={c} />
        ))}
      </div>
    </Card>
  )
}

function ClassRow({ entry }: { entry: ClassEntry }) {
  const isLive = entry.status === "live"
  return (
    <div
      className={cn(
        "grid grid-cols-[92px_1fr_auto_auto] items-center gap-[18px] border-b border-border px-[22px] py-3.5 transition-colors duration-[120ms]",
        "last:border-b-0 hover:bg-surface-alt",
        isLive && "bg-teal-500/[0.05]",
      )}
    >
      {/* Time */}
      <div className="font-mono text-[13px] leading-[1.3] text-foreground tabular-nums">
        {entry.time}
        <span className="mt-0.5 block text-[11px] text-text-3">{entry.duration}</span>
      </div>

      {/* Who */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[14.5px] leading-[1.3] text-foreground">
          {isLive && <span aria-hidden className="live-dot" />}
          {entry.student}
        </div>
        <div className="mt-0.5 flex items-center gap-2 font-mono text-[12px] tracking-[0.02em] text-text-3">
          <span>{entry.level}</span>
          <RowDot />
          <span>{entry.program}</span>
          <RowDot />
          <span>{entry.modality}</span>
        </div>
      </div>

      {/* Teacher */}
      <div className="flex items-center gap-2 text-[13px] text-text-2">
        <Avatar size="sm" initials={entry.teacherInitials} />
        {entry.teacherName}
      </div>

      {/* Action */}
      <ActionButton action={entry.action} />
    </div>
  )
}

function RowDot() {
  return <span aria-hidden className="inline-block h-[3px] w-[3px] rounded-full bg-text-4" />
}

function ActionButton({ action }: { action: ClassEntry["action"] }) {
  const config = {
    join: {
      label: "Unirse",
      icon: Video,
      solid: true,
    },
    observe: {
      label: "Observar",
      icon: Eye,
      solid: false,
    },
    details: {
      label: "Detalles",
      icon: Calendar,
      solid: false,
    },
  }[action]
  const Icon = config.icon

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px]",
        "transition-colors duration-[120ms]",
        config.solid
          ? "border-teal-500 bg-teal-500 text-bone hover:border-teal-700 hover:bg-teal-700"
          : "border-border bg-transparent text-text-2 hover:border-teal-500 hover:text-teal-500",
      )}
    >
      <Icon size={12} strokeWidth={1.6} />
      {config.label}
    </button>
  )
}
