import type { Route } from "next"
import type { Metadata } from "next"
import { AttendanceStatus, SessionStatus } from "@prisma/client"
import { Calendar, CalendarCheck, Clock, ExternalLink, History, MapPin, Video } from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { listStudentSessions, type StudentSessionListItem } from "@/modules/classes/queries"
import { Tag } from "@/components/ui/tag"
import { EmptyState } from "@/components/ui/empty-state"

export const metadata: Metadata = { title: "Mis clases" }

const STATUS_LABEL: Record<SessionStatus, string> = {
  SCHEDULED: "Programada",
  COMPLETED: "Cerrada",
  CANCELLED: "Cancelada",
  NO_SHOW: "Sin asistencia",
}

const MODALITY_LABEL: Record<string, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrida",
}

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Asististe",
  ABSENT: "Faltaste",
  LATE: "Llegaste tarde",
  EXCUSED: "Falta justificada",
  PENDING: "Sin registrar",
}

export default async function StudentClasesPage() {
  const user = await requireRole(["STUDENT"])

  const now = new Date()
  const startOfDay = startOfTodayUTC()
  const in14Days = new Date(startOfDay.getTime() + 14 * 86_400_000)
  const fourteenDaysAgo = new Date(startOfDay.getTime() - 14 * 86_400_000)

  const [upcoming, recentPast] = await Promise.all([
    listStudentSessions(user.id, {
      from: startOfDay,
      to: in14Days,
      status: [SessionStatus.SCHEDULED, SessionStatus.COMPLETED, SessionStatus.CANCELLED],
    }),
    listStudentSessions(user.id, {
      from: fourteenDaysAgo,
      to: startOfDay,
      status: [SessionStatus.COMPLETED, SessionStatus.CANCELLED, SessionStatus.NO_SHOW],
    }),
  ])

  const today = upcoming.filter(
    (s) => isSameGuayaquilDay(s.scheduledStart, now) && s.status !== SessionStatus.CANCELLED,
  )
  const next = upcoming.filter((s) => !today.includes(s))

  // Histórico — orden inverso (más reciente arriba), solo últimos 14 días
  // que ya hayan terminado.
  const past = [...recentPast].reverse()

  return (
    <AppShell
      role={user.role!}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role!),
      }}
      breadcrumbs={[
        { label: "Estudiante", href: "/estudiante/dashboard" as Route },
        { label: "Mis clases" },
      ]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Académico
        </p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Mis clases
        </h1>
        <p className="text-text-3 mt-2 text-[14px] leading-[1.55]">
          Lo que tienes hoy, lo que viene en los próximos días y un resumen de las últimas semanas.
          Si la clase es virtual, vas a encontrar el enlace acá.
        </p>
      </header>

      {today.length > 0 && (
        <Section
          title="Hoy"
          icon={Clock}
          description={`${today.length} ${today.length === 1 ? "clase" : "clases"} en el día.`}
        >
          <SessionList items={today} highlight="today" />
        </Section>
      )}

      <Section
        title="Próximas"
        icon={Calendar}
        description="Tus clases programadas en los próximos días."
      >
        {next.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="Sin clases próximas"
            description="Cuando coordinación programe nuevas sesiones para tu aula, vas a verlas acá."
          />
        ) : (
          <SessionList items={next} highlight="default" />
        )}
      </Section>

      {past.length > 0 && (
        <Section
          title="Últimas dos semanas"
          icon={History}
          description={`${past.length} ${past.length === 1 ? "clase" : "clases"} en el histórico reciente.`}
        >
          <SessionList items={past} highlight="past" />
        </Section>
      )}
    </AppShell>
  )
}

// -----------------------------------------------------------------------------
//  Sub-componentes
// -----------------------------------------------------------------------------

function Section({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string
  icon: typeof Clock
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <header className="mb-3 flex flex-wrap items-baseline gap-2">
        <Icon size={14} strokeWidth={1.6} className="text-text-3" />
        <h2 className="text-foreground font-serif text-[20px] font-normal">{title}</h2>
        {description && <span className="text-text-3 text-[12.5px]">{description}</span>}
      </header>
      {children}
    </section>
  )
}

function SessionList({
  items,
  highlight,
}: {
  items: StudentSessionListItem[]
  highlight: "today" | "default" | "past"
}) {
  return (
    <ul className="space-y-2.5">
      {items.map((s) => (
        <li key={s.id}>
          <SessionRow item={s} highlight={highlight} />
        </li>
      ))}
    </ul>
  )
}

function SessionRow({
  item,
  highlight,
}: {
  item: StudentSessionListItem
  highlight: "today" | "default" | "past"
}) {
  const dateParts = splitGuayaquilDateLabel(item.scheduledStart)
  const timeLabel = formatGuayaquilTimeRange(item.scheduledStart, item.scheduledEnd)
  const isCancelled = item.status === SessionStatus.CANCELLED
  const isClosed = item.status === SessionStatus.COMPLETED
  const isNoShow = item.status === SessionStatus.NO_SHOW
  const isScheduled = item.status === SessionStatus.SCHEDULED
  const isVirtual = item.modality === "VIRTUAL" || item.modality === "HIBRIDO"
  const isPresencial = item.modality === "PRESENCIAL" || item.modality === "HIBRIDO"

  const cardClass = [
    "relative overflow-hidden rounded-xl border bg-surface transition-colors",
    highlight === "today" &&
      "border-teal-500/30 shadow-[0_1px_0_rgba(39,159,137,0.06),0_6px_18px_-12px_rgba(39,159,137,0.20)]",
    highlight === "default" && "border-border hover:border-border-strong",
    highlight === "past" && "border-border/70 bg-surface-alt",
    isCancelled && "opacity-60",
  ]
    .filter(Boolean)
    .join(" ")

  const accentClass =
    highlight === "today"
      ? "bg-gradient-to-b from-teal-500 to-teal-700"
      : highlight === "past"
        ? "bg-border"
        : "bg-border-strong/60"

  return (
    <div className={cardClass}>
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${accentClass}`} />
      <div className="flex flex-wrap items-center gap-4 px-4 py-3.5 pl-5">
        <div className="min-w-[112px]">
          <div className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
            {dateParts.weekday}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-foreground font-serif text-[22px] leading-none font-normal tracking-[-0.01em]">
              {dateParts.day}
            </span>
            <span className="text-text-3 text-[12px]">{dateParts.month}</span>
          </div>
          <div className="text-text-2 mt-1.5 font-mono text-[12.5px] tracking-[0.02em]">
            {timeLabel}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-foreground text-[14.5px] font-medium">{item.classGroupName}</div>
          <div className="text-text-3 mt-0.5 text-[12.5px]">{item.programLabel}</div>
          {item.teacherName && (
            <div className="text-text-3 mt-0.5 text-[12.5px]">
              <span className="text-text-4">Docente:</span> {item.teacherName}
            </div>
          )}
          {isCancelled && item.cancelReason && (
            <div className="text-warning mt-1.5 text-[12px]">Motivo: {item.cancelReason}</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tag>{MODALITY_LABEL[item.modality] ?? item.modality}</Tag>

          {isScheduled && isPresencial && item.location && (
            <span className="border-border bg-surface text-text-3 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px]">
              <MapPin size={11} strokeWidth={1.6} />
              {item.location}
            </span>
          )}

          {(isClosed || isCancelled || isNoShow) && (
            <span className="text-text-3 font-mono text-[11.5px]">{STATUS_LABEL[item.status]}</span>
          )}

          {item.attendance && (isClosed || isNoShow) && (
            <span
              className={[
                "font-mono text-[11.5px]",
                item.attendance === AttendanceStatus.PRESENT
                  ? "text-teal-600"
                  : item.attendance === AttendanceStatus.LATE
                    ? "text-warning"
                    : item.attendance === AttendanceStatus.EXCUSED
                      ? "text-text-3"
                      : "text-danger",
              ].join(" ")}
            >
              {ATTENDANCE_LABEL[item.attendance]}
            </span>
          )}

          {isScheduled && isVirtual && item.meetingUrl && (
            <a
              href={item.meetingUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={[
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                highlight === "today"
                  ? "hover:bg-teal-deep bg-teal-500 text-white"
                  : "border border-teal-500/40 text-teal-700 hover:border-teal-500 hover:bg-teal-500/10",
              ].join(" ")}
            >
              <Video size={12} strokeWidth={1.8} />
              Unirse
              <ExternalLink size={11} strokeWidth={1.6} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
//  Helpers de fecha (Guayaquil = UTC-5 fijo, sin DST)
// -----------------------------------------------------------------------------

function startOfTodayUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function isSameGuayaquilDay(a: Date, b: Date): boolean {
  return formatGuayaquilDay(a) === formatGuayaquilDay(b)
}

function formatGuayaquilDay(d: Date): string {
  const local = new Date(d.getTime() - 5 * 3_600_000)
  return `${local.getUTCFullYear()}-${local.getUTCMonth() + 1}-${local.getUTCDate()}`
}

function splitGuayaquilDateLabel(d: Date): {
  weekday: string
  day: string
  month: string
} {
  const parts = new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).formatToParts(d)
  const lookup = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return {
    weekday: lookup("weekday").replace(/\.$/, ""),
    day: lookup("day"),
    month: lookup("month").replace(/\.$/, ""),
  }
}

function formatGuayaquilTimeRange(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  return `${fmt.format(start)} – ${fmt.format(end)}`
}
