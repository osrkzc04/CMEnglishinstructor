import type { Route } from "next"
import type { Metadata } from "next"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CalendarCheck,
  Clock,
  ExternalLink,
  MapPin,
  Video,
} from "lucide-react"
import { SessionStatus } from "@prisma/client"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  listTeacherSessions,
  type TeacherSessionListItem,
} from "@/modules/classes/queries"
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

export default async function TeacherClasesPage() {
  const user = await requireRole(["TEACHER"])

  const now = new Date()
  const startOfDay = startOfTodayUTC()
  const in14Days = new Date(startOfDay.getTime() + 14 * 86_400_000)

  const upcoming = await listTeacherSessions(user.id, {
    from: startOfDay,
    to: in14Days,
    status: [
      SessionStatus.SCHEDULED,
      SessionStatus.COMPLETED,
      SessionStatus.CANCELLED,
    ],
  })

  // Detectar sesiones SCHEDULED cuyo `scheduledEnd` ya pasó — el docente las
  // dejó sin cerrar. Las mostramos arriba como "pendientes de cierre".
  const overdue = upcoming.filter(
    (s) =>
      s.status === SessionStatus.SCHEDULED && s.scheduledEnd.getTime() < now.getTime(),
  )
  const today = upcoming.filter(
    (s) =>
      !overdue.includes(s) &&
      isSameGuayaquilDay(s.scheduledStart, now) &&
      s.status !== SessionStatus.CANCELLED,
  )
  const next = upcoming.filter(
    (s) => !overdue.includes(s) && !today.includes(s),
  )

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
        { label: "Mis clases" },
      ]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
          Mi día
        </p>
        <h1 className="font-serif text-[32px] font-normal leading-[1.18] tracking-[-0.02em]">
          Mis clases
        </h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-text-3">
          Hoy y los próximos 14 días. Click en una clase para tomar asistencia,
          escribir bitácora y cerrarla.
        </p>
      </header>

      {overdue.length > 0 && (
        <Section
          title="Sin cerrar"
          variant="warning"
          icon={AlertTriangle}
          description={`${overdue.length} ${overdue.length === 1 ? "clase pasó" : "clases pasaron"} su horario y siguen abiertas.`}
        >
          <SessionList items={overdue} highlight="warning" />
        </Section>
      )}

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
        description="Clases programadas en los próximos días."
      >
        {next.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="Sin clases próximas"
            description="Cuando coordinación programe nuevas sesiones para tus aulas, vas a verlas acá."
          />
        ) : (
          <SessionList items={next} highlight="default" />
        )}
      </Section>
    </AppShell>
  )
}

// -----------------------------------------------------------------------------
//  Componentes auxiliares
// -----------------------------------------------------------------------------

function Section({
  title,
  icon: Icon,
  description,
  variant,
  children,
}: {
  title: string
  icon: typeof Clock
  description?: string
  variant?: "warning"
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <header className="mb-3 flex flex-wrap items-baseline gap-2">
        <Icon
          size={14}
          strokeWidth={1.6}
          className={variant === "warning" ? "text-warning" : "text-text-3"}
        />
        <h2 className="font-serif text-[20px] font-normal text-foreground">
          {title}
        </h2>
        {description && (
          <span className="text-[12.5px] text-text-3">{description}</span>
        )}
      </header>
      {children}
    </section>
  )
}

function SessionList({
  items,
  highlight,
}: {
  items: TeacherSessionListItem[]
  highlight: "warning" | "today" | "default"
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
  item: TeacherSessionListItem
  highlight: "warning" | "today" | "default"
}) {
  const dateParts = splitGuayaquilDateLabel(item.scheduledStart)
  const timeLabel = formatGuayaquilTimeRange(
    item.scheduledStart,
    item.scheduledEnd,
  )
  const isCancelled = item.status === SessionStatus.CANCELLED
  const isClosed = item.status === SessionStatus.COMPLETED
  const isScheduled = item.status === SessionStatus.SCHEDULED
  const isVirtual = item.modality === "VIRTUAL" || item.modality === "HIBRIDO"
  const isPresencial =
    item.modality === "PRESENCIAL" || item.modality === "HIBRIDO"

  const accentClass =
    highlight === "warning"
      ? "bg-gradient-to-b from-warning to-warning/70"
      : highlight === "today"
        ? "bg-gradient-to-b from-teal-500 to-teal-700"
        : "bg-border-strong/60"

  const cardClass = [
    "group relative overflow-hidden rounded-xl border bg-surface transition-colors",
    highlight === "warning"
      ? "border-warning/40 hover:border-warning"
      : highlight === "today"
        ? "border-teal-500/30 shadow-[0_1px_0_rgba(39,159,137,0.06),0_6px_18px_-12px_rgba(39,159,137,0.20)] hover:border-teal-500"
        : "border-border hover:border-border-strong",
    isCancelled && "opacity-60",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className={cardClass}>
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${accentClass}`} />
      <div className="flex flex-wrap items-center gap-4 px-4 py-3.5 pl-5">
        <Link
          href={`/docente/clases/${item.id}` as Route}
          className="absolute inset-0"
          aria-label={`Abrir ${item.classGroupName}`}
        />
        <div className="min-w-[112px]">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
            {dateParts.weekday}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="font-serif text-[22px] font-normal leading-none tracking-[-0.01em] text-foreground">
              {dateParts.day}
            </span>
            <span className="text-[12px] text-text-3">{dateParts.month}</span>
          </div>
          <div className="mt-1.5 font-mono text-[12.5px] tracking-[0.02em] text-text-2">
            {timeLabel}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-medium text-[14.5px] text-foreground">
            {item.classGroupName}
          </div>
          <div className="mt-0.5 text-[12.5px] text-text-3">
            {item.programLabel}
          </div>
          <div className="mt-0.5 text-[12.5px] text-text-3">
            {item.participantCount}{" "}
            {item.participantCount === 1 ? "alumno" : "alumnos"}
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <Tag>{MODALITY_LABEL[item.modality] ?? item.modality}</Tag>

          {isScheduled && isPresencial && item.location && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[12px] text-text-3">
              <MapPin size={11} strokeWidth={1.6} />
              {item.location}
            </span>
          )}

          {(isClosed || isCancelled) && (
            <span className="font-mono text-[11.5px] text-text-3">
              {STATUS_LABEL[item.status]}
            </span>
          )}
          {!isClosed && !isCancelled && item.hasLog && (
            <span className="font-mono text-[11.5px] text-teal-600">Bitácora</span>
          )}

          {isScheduled && isVirtual && item.meetingUrl && (
            <a
              href={item.meetingUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={[
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                highlight === "today"
                  ? "bg-teal-500 text-white hover:bg-teal-deep"
                  : "border border-teal-500/40 text-teal-700 hover:border-teal-500 hover:bg-teal-500/10",
              ].join(" ")}
            >
              <Video size={12} strokeWidth={1.8} />
              Unirse
              <ExternalLink size={11} strokeWidth={1.6} />
            </a>
          )}

          <ArrowUpRight
            size={13}
            strokeWidth={1.6}
            className="text-text-3 transition-colors group-hover:text-teal-500"
          />
        </div>
      </div>
    </div>
  )
}

function startOfTodayUTC(): Date {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
}

function isSameGuayaquilDay(a: Date, b: Date): boolean {
  return formatGuayaquilDay(a) === formatGuayaquilDay(b)
}

function formatGuayaquilDay(d: Date): string {
  // Guayaquil = UTC-5 fijo
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
  const lookup = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? ""
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
