import type { Route } from "next"
import type { Metadata } from "next"
import Link from "next/link"
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Users,
  Video,
} from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  listTeacherWeekAgenda,
  type TeacherWeekSession,
} from "@/modules/teachers/queries"
import { Tag } from "@/components/ui/tag"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Agenda" }

const DAYS_FULL_ES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
]

const MODALITY_LABEL: Record<string, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrida",
}

const STATUS_LABEL: Record<TeacherWeekSession["status"], string> = {
  live: "En curso",
  scheduled: "Programada",
  completed: "Cerrada",
  cancelled: "Cancelada",
  no_show: "Sin registro",
}

export default async function TeacherAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>
}) {
  const user = await requireRole(["TEACHER"])
  const params = await searchParams

  const weekStart = parseWeekStart(params.w)
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000)
  const today = startOfGuayaquilDay(new Date())

  const sessions = await listTeacherWeekAgenda(user.id, weekStart)
  const byDay = groupByGuayaquilDay(sessions, weekStart)
  const aulasInWeek = new Set(sessions.map((s) => s.classGroupId)).size
  const totalMinutes = sessions.reduce(
    (acc, s) => acc + (s.scheduledEnd.getTime() - s.scheduledStart.getTime()) / 60_000,
    0,
  )

  const prevWeek = formatWeekParam(new Date(weekStart.getTime() - 7 * 86_400_000))
  const nextWeek = formatWeekParam(new Date(weekStart.getTime() + 7 * 86_400_000))
  const isCurrentWeek = weekStart.getTime() === computeMondayOfWeek(today).getTime()

  return (
    <AppShell
      role={user.role!}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role!),
      }}
      breadcrumbs={[
        { label: "Docente", href: "/docente/dashboard" as Route },
        { label: "Agenda" },
      ]}
    >
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
            Mi día
          </p>
          <h1 className="font-serif text-[32px] font-normal leading-[1.18] tracking-[-0.02em]">
            Agenda
          </h1>
          <p className="mt-2 max-w-[560px] text-[14px] leading-[1.55] text-text-3">
            Tu calendario de la semana. Click en cualquier sesión para tomar
            asistencia, escribir bitácora y cerrarla.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[12.5px] tracking-[0.04em] text-text-3">
          <span>{sessions.length} {sessions.length === 1 ? "clase" : "clases"}</span>
          <span aria-hidden>·</span>
          <span>{aulasInWeek} {aulasInWeek === 1 ? "aula" : "aulas"}</span>
          <span aria-hidden>·</span>
          <span>{(totalMinutes / 60).toFixed(1)} h</span>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <div>
          <div className="font-serif text-[18px] font-normal tracking-[-0.01em] text-foreground">
            {formatWeekTitle(weekStart, weekEnd)}
          </div>
          <div className="mt-0.5 font-mono text-[12px] tracking-[0.02em] text-text-3">
            {isCurrentWeek ? "Esta semana" : "Otra semana"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/docente/agenda?w=${prevWeek}` as Route}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[12.5px] text-text-2 transition-colors hover:border-teal-500 hover:text-teal-500"
          >
            <ChevronLeft size={13} strokeWidth={1.6} />
            Anterior
          </Link>
          {!isCurrentWeek && (
            <Link
              href={"/docente/agenda" as Route}
              className="inline-flex h-9 items-center rounded-md border border-teal-500/40 bg-teal-500/[0.07] px-3 text-[12.5px] text-teal-700 transition-colors hover:border-teal-500 hover:bg-teal-500/15"
            >
              Hoy
            </Link>
          )}
          <Link
            href={`/docente/agenda?w=${nextWeek}` as Route}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[12.5px] text-text-2 transition-colors hover:border-teal-500 hover:text-teal-500"
          >
            Siguiente
            <ChevronRight size={13} strokeWidth={1.6} />
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {byDay.map((day) => {
          const isToday = day.date.getTime() === today.getTime()
          return (
            <DayColumn
              key={day.date.getTime()}
              date={day.date}
              sessions={day.sessions}
              isToday={isToday}
            />
          )
        })}
      </div>
    </AppShell>
  )
}

// -----------------------------------------------------------------------------
//  Componentes
// -----------------------------------------------------------------------------

function DayColumn({
  date,
  sessions,
  isToday,
}: {
  date: Date
  sessions: TeacherWeekSession[]
  isToday: boolean
}) {
  const dayIdx = guayaquilDayOfWeek(date) // 0=lunes
  const dayName = DAYS_FULL_ES[dayIdx] ?? ""
  const dayNumber = formatGuayaquilDayOfMonth(date)

  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border bg-surface",
        isToday ? "border-teal-500/40" : "border-border",
      )}
    >
      <header
        className={cn(
          "flex items-baseline justify-between border-b px-3 py-2.5",
          isToday ? "border-teal-500/30 bg-teal-500/[0.05]" : "border-border",
        )}
      >
        <div>
          <div
            className={cn(
              "font-mono text-[11px] uppercase tracking-[0.08em]",
              isToday ? "text-teal-700" : "text-text-3",
            )}
          >
            {dayName}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="font-serif text-[20px] font-normal leading-none tracking-[-0.01em] text-foreground">
              {dayNumber}
            </span>
            {isToday && (
              <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-teal-700">
                Hoy
              </span>
            )}
          </div>
        </div>
        {sessions.length > 0 && (
          <span className="font-mono text-[11px] tracking-[0.02em] text-text-3">
            {sessions.length}
          </span>
        )}
      </header>
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        {sessions.length === 0 ? (
          <p className="text-[12.5px] text-text-4">Sin clases</p>
        ) : (
          sessions.map((s) => <SessionCard key={s.id} session={s} />)
        )}
      </div>
    </section>
  )
}

function SessionCard({ session }: { session: TeacherWeekSession }) {
  const isLive = session.status === "live"
  const isScheduled = session.status === "scheduled" || isLive
  const isVirtual =
    session.modality === "VIRTUAL" || session.modality === "HIBRIDO"
  const isPresencial =
    session.modality === "PRESENCIAL" || session.modality === "HIBRIDO"

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-surface",
        isLive
          ? "border-teal-500/40 bg-teal-500/[0.05]"
          : "border-border hover:border-border-strong",
        session.status === "cancelled" && "opacity-60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          isLive
            ? "bg-gradient-to-b from-teal-500 to-teal-700"
            : session.status === "completed"
              ? "bg-border-strong/60"
              : session.status === "no_show"
                ? "bg-warning/70"
                : session.status === "cancelled"
                  ? "bg-danger/60"
                  : "bg-border-strong/60",
        )}
      />
      <div className="px-3 py-2.5 pl-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            {isLive && <span aria-hidden className="live-dot" />}
            <span className="font-mono text-[12.5px] tracking-[0.02em] text-foreground tabular-nums">
              {formatTime(session.scheduledStart)}
            </span>
            <span className="font-mono text-[11px] text-text-3">
              · {Math.round(
                (session.scheduledEnd.getTime() - session.scheduledStart.getTime()) /
                  60_000,
              )}{" "}
              min
            </span>
          </div>
          <Tag>{MODALITY_LABEL[session.modality] ?? session.modality}</Tag>
        </div>
        <Link
          href={`/docente/clases/${session.id}` as Route}
          className="mt-1.5 block truncate text-[13.5px] font-medium leading-tight text-foreground transition-colors hover:text-teal-500"
        >
          {session.classGroupName}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11.5px] tracking-[0.02em] text-text-3">
          <span className="inline-flex items-center gap-1">
            <Users size={10} strokeWidth={1.6} />
            {session.participantCount}
          </span>
          {!isScheduled && (
            <>
              <span aria-hidden>·</span>
              <span>{STATUS_LABEL[session.status]}</span>
            </>
          )}
          {isPresencial && isScheduled && session.location && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin size={10} strokeWidth={1.6} />
              <span className="truncate">{session.location}</span>
            </span>
          )}
        </div>
        {isScheduled && isVirtual && session.meetingUrl && (
          <a
            href={session.meetingUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(
              "mt-2 inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors",
              isLive
                ? "bg-teal-500 text-bone hover:bg-teal-deep"
                : "border border-teal-500/40 text-teal-700 hover:border-teal-500 hover:bg-teal-500/10",
            )}
          >
            <Video size={11} strokeWidth={1.8} />
            Unirse
            <ExternalLink size={10} strokeWidth={1.6} />
          </a>
        )}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
//  Helpers de fecha (Guayaquil = UTC-5 fijo, sin DST)
// -----------------------------------------------------------------------------

const GUAYAQUIL_OFFSET_MS = 5 * 60 * 60 * 1000

function parseWeekStart(raw?: string): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number) as [number, number, number]
    const guess = new Date(Date.UTC(y, m - 1, d) + GUAYAQUIL_OFFSET_MS)
    return computeMondayOfWeek(guess)
  }
  return computeMondayOfWeek(startOfGuayaquilDay(new Date()))
}

function startOfGuayaquilDay(now: Date): Date {
  const localMs = now.getTime() - GUAYAQUIL_OFFSET_MS
  const local = new Date(localMs)
  const utcMidnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  )
  return new Date(utcMidnight + GUAYAQUIL_OFFSET_MS)
}

function computeMondayOfWeek(d: Date): Date {
  // d ya viene en "00:00 Guayaquil expresado en UTC". Sumamos -offset para
  // obtener el día de la semana en hora local, y calculamos cuántos días
  // restar para llegar al lunes.
  const local = new Date(d.getTime() - GUAYAQUIL_OFFSET_MS)
  const dow = local.getUTCDay() // 0=domingo, 1=lunes, ..., 6=sábado
  const daysFromMonday = dow === 0 ? 6 : dow - 1
  return new Date(d.getTime() - daysFromMonday * 86_400_000)
}

function formatWeekParam(d: Date): string {
  // Devuelve YYYY-MM-DD del lunes en zona Guayaquil.
  const local = new Date(d.getTime() - GUAYAQUIL_OFFSET_MS)
  const y = local.getUTCFullYear()
  const m = String(local.getUTCMonth() + 1).padStart(2, "0")
  const day = String(local.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function groupByGuayaquilDay(
  sessions: TeacherWeekSession[],
  weekStart: Date,
): { date: Date; sessions: TeacherWeekSession[] }[] {
  const days = Array.from({ length: 7 }).map((_, i) => ({
    date: new Date(weekStart.getTime() + i * 86_400_000),
    sessions: [] as TeacherWeekSession[],
  }))
  for (const s of sessions) {
    const dayStart = startOfGuayaquilDay(s.scheduledStart)
    const idx = Math.round(
      (dayStart.getTime() - weekStart.getTime()) / 86_400_000,
    )
    if (idx >= 0 && idx < 7) {
      days[idx]?.sessions.push(s)
    }
  }
  return days
}

function guayaquilDayOfWeek(d: Date): number {
  // 0=lunes, 6=domingo
  const local = new Date(d.getTime() - GUAYAQUIL_OFFSET_MS)
  const dow = local.getUTCDay()
  return dow === 0 ? 6 : dow - 1
}

const dayOfMonthFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  timeZone: "America/Guayaquil",
})

const monthFormatter = new Intl.DateTimeFormat("es-EC", {
  month: "long",
  year: "numeric",
  timeZone: "America/Guayaquil",
})

const dayLongFormatter = new Intl.DateTimeFormat("es-EC", {
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

function formatGuayaquilDayOfMonth(d: Date): string {
  return dayOfMonthFormatter.format(d)
}

function formatTime(d: Date): string {
  return timeFormatter.format(d)
}

function formatWeekTitle(start: Date, end: Date): string {
  const endLast = new Date(end.getTime() - 86_400_000) // domingo (inclusive)
  const startMonthYear = monthFormatter.format(start)
  const endMonthYear = monthFormatter.format(endLast)
  if (startMonthYear === endMonthYear) {
    return `${dayLongFormatter.format(start).replace(/\.$/, "")} – ${dayLongFormatter.format(endLast).replace(/\.$/, "")}`
  }
  return `${dayLongFormatter.format(start).replace(/\.$/, "")} – ${dayLongFormatter.format(endLast).replace(/\.$/, "")}`
}
