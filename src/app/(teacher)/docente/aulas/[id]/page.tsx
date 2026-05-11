import { notFound } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import type { Metadata } from "next"
import {
  ArrowUpRight,
  CalendarClock,
  ExternalLink,
  MapPin,
  Video,
} from "lucide-react"
import { ClassGroupStatus, SessionStatus } from "@prisma/client"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getTeacherClassGroupDetail } from "@/modules/classGroups/queries"
import { Tag } from "@/components/ui/tag"
import { HoursProgress } from "@/components/shared/HoursProgress"
import { TeacherMetadataForm } from "./_components/TeacherMetadataForm"

export const metadata: Metadata = { title: "Aula" }

const DAYS_ES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
]

const MODALITY_LABEL: Record<string, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrida",
}

const STATUS_TONE: Record<
  ClassGroupStatus,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "Activa",
    className: "border-teal-500/40 bg-teal-500/10 text-teal-700",
  },
  COMPLETED: {
    label: "Cerrada",
    className: "border-border bg-bone-50 text-text-3",
  },
  CANCELLED: {
    label: "Cancelada",
    className: "border-danger/30 bg-danger/5 text-danger",
  },
}

const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  SCHEDULED: "Programada",
  COMPLETED: "Cerrada",
  CANCELLED: "Cancelada",
  NO_SHOW: "Sin registro",
}

type RouteParams = { id: string }

export default async function TeacherAulaDetallePage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const user = await requireRole(["TEACHER"])
  const { id } = await params

  const detail = await getTeacherClassGroupDetail(user.id, id)
  if (!detail) notFound()

  const isActive = detail.status === ClassGroupStatus.ACTIVE
  const statusTone = STATUS_TONE[detail.status]
  const isVirtual =
    detail.modality === "VIRTUAL" || detail.modality === "HIBRIDO"
  const isPresencial =
    detail.modality === "PRESENCIAL" || detail.modality === "HIBRIDO"

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
        { label: "Mis aulas", href: "/docente/aulas" as Route },
        { label: detail.name },
      ]}
    >
      <header className="mb-7">
        <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
          Aula
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-[32px] font-normal leading-[1.18] tracking-[-0.02em]">
            {detail.name}
          </h1>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] ${statusTone.className}`}
          >
            {statusTone.label}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-2.5 text-[13.5px] text-text-3">
          <span>{detail.programLevel.programLabel}</span>
          <span aria-hidden>·</span>
          <span>{MODALITY_LABEL[detail.modality]}</span>
          <span aria-hidden>·</span>
          <span>{detail.programLevel.classDurationMinutes} min/clase</span>
          {detail.programLevel.cefrLevelCode && (
            <Tag>CEFR {detail.programLevel.cefrLevelCode}</Tag>
          )}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Card title="Datos del aula">
            <TeacherMetadataForm
              classGroupId={detail.id}
              initialValues={{
                name: detail.name,
                defaultMeetingUrl: detail.defaultMeetingUrl ?? undefined,
              }}
              modality={detail.modality}
              disabled={!isActive}
            />
            {isPresencial && detail.defaultLocation && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-1 text-[12px] font-medium uppercase tracking-[0.06em] text-text-3">
                  Ubicación (definida por coordinación)
                </p>
                <p className="inline-flex items-center gap-1.5 text-[13.5px] text-text-2">
                  <MapPin size={13} strokeWidth={1.6} className="text-text-3" />
                  {detail.defaultLocation}
                </p>
              </div>
            )}
          </Card>

          <Card title="Horario semanal">
            {detail.slots.length === 0 ? (
              <p className="text-[13px] text-text-3">Sin bloques cargados.</p>
            ) : (
              <ul className="divide-y divide-border">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const slots = detail.slots.filter((s) => s.dayOfWeek === d)
                  if (slots.length === 0) return null
                  return (
                    <li
                      key={d}
                      className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-2.5 first:pt-0 last:pb-0"
                    >
                      <span className="text-[13.5px] font-medium text-foreground">
                        {DAYS_ES[d]}
                      </span>
                      <span className="font-mono text-[13px] tracking-[0.02em] text-text-2">
                        {slots
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                          .map((s) =>
                            formatSlotRange(s.startTime, s.durationMinutes),
                          )
                          .join("  ·  ")}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card title={`Estudiantes (${detail.enrollments.length})`}>
            {detail.enrollments.length === 0 ? (
              <p className="text-[13px] text-text-3">
                Sin estudiantes inscritos todavía.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {detail.enrollments.map((e) => (
                  <li
                    key={e.enrollmentId}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">
                        {e.studentName}
                      </div>
                      <div className="mt-0.5 text-[12.5px] text-text-3">
                        {e.studentEmail}
                      </div>
                      <div className="mt-1 text-[12px] text-text-3">
                        Desde {formatDate(e.joinedAt)}
                      </div>
                    </div>
                    <div className="min-w-[180px]">
                      <HoursProgress
                        label="Avance"
                        consumed={e.consumedHours}
                        total={e.totalHours}
                        size="sm"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Próximas sesiones">
            {detail.upcomingSessions.length === 0 ? (
              <p className="text-[13px] text-text-3">
                No hay sesiones programadas adelante.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {detail.upcomingSessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="text-[13.5px] capitalize text-foreground">
                        {formatDateLong(s.scheduledStart)}
                      </div>
                      <div className="mt-0.5 font-mono text-[12.5px] text-text-2">
                        {formatTimeRange(s.scheduledStart, s.scheduledEnd)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11.5px] text-text-3">
                        {SESSION_STATUS_LABEL[s.status]}
                      </span>
                      <Link
                        href={`/docente/clases/${s.id}` as Route}
                        className="inline-flex items-center gap-1 text-[12.5px] text-teal-500 hover:underline"
                      >
                        Abrir
                        <ArrowUpRight size={11} strokeWidth={1.6} />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-5">
          <Card title="Información">
            <dl className="space-y-2.5">
              <DLItem label="Programa">
                {detail.programLevel.programLabel}
              </DLItem>
              <DLItem label="Modalidad">
                {MODALITY_LABEL[detail.modality]}
              </DLItem>
              <DLItem label="Horas">
                {detail.programLevel.totalHours} h
              </DLItem>
              <DLItem label="Creada">{formatDate(detail.createdAt)}</DLItem>
              <DLItem label="Alumnos">{detail.enrollments.length}</DLItem>
            </dl>
          </Card>

          {isVirtual && (
            <Card title="Reunión">
              {detail.defaultMeetingUrl ? (
                <a
                  href={detail.defaultMeetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-teal-deep"
                >
                  <Video size={14} strokeWidth={1.8} />
                  Conectar a la reunión
                  <ExternalLink size={11} strokeWidth={1.8} />
                </a>
              ) : (
                <p className="text-[13px] text-text-3">
                  Aún no cargaste el link. Pegálo en &ldquo;Datos del
                  aula&rdquo; para que estudiantes lo vean.
                </p>
              )}
            </Card>
          )}

          <Card title="Atajos">
            <ul className="space-y-2">
              <li>
                <Link
                  href={"/docente/clases" as Route}
                  className="inline-flex items-center gap-1.5 text-[13px] text-text-2 hover:text-teal-500"
                >
                  <CalendarClock size={12} strokeWidth={1.6} />
                  Ver todas mis clases
                </Link>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </AppShell>
  )
}

// -----------------------------------------------------------------------------
//  Sub-componentes locales
// -----------------------------------------------------------------------------

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 lg:p-6">
      <h2 className="mb-4 font-serif text-[18px] font-normal tracking-[-0.01em] text-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

function DLItem({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-3">
      <dt className="text-[12px] font-medium uppercase tracking-[0.06em] text-text-3">
        {label}
      </dt>
      <dd className="text-[13.5px] text-foreground">{children}</dd>
    </div>
  )
}

function formatSlotRange(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number) as [number, number]
  const totalEnd = h * 60 + m + durationMinutes
  const eh = Math.floor(totalEnd / 60)
  const em = totalEnd % 60
  return `${startTime}–${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`
}

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Guayaquil",
})

const dateLongFormatter = new Intl.DateTimeFormat("es-EC", {
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

function formatDate(d: Date): string {
  return dateFormatter.format(d).replace(/\./g, "")
}

function formatDateLong(d: Date): string {
  return dateLongFormatter.format(d).replace(/\./g, "")
}

function formatTimeRange(start: Date, end: Date): string {
  return `${timeFormatter.format(start)} – ${timeFormatter.format(end)}`
}
