import type { Route } from "next"
import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowUpRight,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Check,
  Clock,
  FolderOpen,
  GraduationCap,
  History,
  School,
  TrendingUp,
  X,
} from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  getStudentProgress,
  type StudentClosedEnrollment,
  type StudentProgress,
  type StudentProgressEnrollment,
  type StudentProgressHistoryItem,
} from "@/modules/students/queries"
import { KpiBand, type Kpi } from "@/components/dashboard/KpiBand"
import { LevelsCard, type LevelEntry } from "@/components/dashboard/LevelsCard"
import { HoursProgress } from "@/components/shared/HoursProgress"
import { Tag } from "@/components/ui/tag"
import { ProgressBar } from "@/components/ui/progress-bar"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Mi progreso" }

const DAYS_SHORT_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

const MODALITY_LABEL: Record<string, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrida",
}

const ATTENDANCE_LABEL: Record<
  StudentProgressHistoryItem["attendance"],
  string
> = {
  PRESENT: "Asististe",
  LATE: "Llegaste tarde",
  ABSENT: "Faltaste",
  EXCUSED: "Falta justificada",
  PENDING: "Sin registrar",
}

const CLOSED_LABEL: Record<StudentClosedEnrollment["status"], string> = {
  ACTIVE: "Activa",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  PAUSED: "Pausada",
}

export default async function StudentProgresoPage() {
  const user = await requireRole(["STUDENT"])
  const progress = await getStudentProgress(user.id)

  const hasAnyData =
    progress.activeEnrollments.length > 0 ||
    progress.closedEnrollments.length > 0

  if (!hasAnyData) {
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
          { label: "Mi progreso" },
        ]}
      >
        <ProgressHeader />
        <EmptyState
          icon={GraduationCap}
          title="Aún sin matrículas registradas"
          description="Cuando coordinación publique tu primera matrícula vas a ver acá tu avance, asistencia y bitácoras."
        />
      </AppShell>
    )
  }

  const kpis = buildKpis(progress)
  const attendanceRows = buildAttendanceRows(progress.attendance)

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
        { label: "Mi progreso" },
      ]}
    >
      <ProgressHeader subtitle={buildSubtitle(progress)} />

      <KpiBand items={kpis} />

      {progress.activeEnrollments.length > 0 && (
        <section aria-labelledby="active-levels" className="mb-7">
          <header className="mb-3 flex flex-wrap items-baseline gap-2">
            <TrendingUp size={14} strokeWidth={1.6} className="text-text-3" />
            <h2
              id="active-levels"
              className="font-serif text-[20px] font-normal text-foreground"
            >
              {progress.activeEnrollments.length === 1
                ? "Mi nivel actual"
                : "Mis niveles actuales"}
            </h2>
            <span className="text-[12.5px] text-text-3">
              {progress.activeEnrollments.length}{" "}
              {progress.activeEnrollments.length === 1
                ? "matrícula activa"
                : "matrículas activas"}
            </span>
          </header>
          <ul className="space-y-3">
            {progress.activeEnrollments.map((e) => (
              <li key={e.enrollmentId}>
                <ActiveLevelCard enrollment={e} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-7 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        {attendanceRows.length > 0 ? (
          <LevelsCard
            items={attendanceRows}
            meta={buildAttendanceMeta(progress.attendance)}
          />
        ) : (
          <section className="rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-alt text-text-3">
              <CalendarCheck size={20} strokeWidth={1.6} />
            </div>
            <h2 className="mt-3.5 font-serif text-[18px] italic font-light tracking-[-0.01em]">
              Sin asistencias registradas
            </h2>
            <p className="mx-auto mt-1 max-w-[420px] text-[13.5px] text-text-2">
              Tu resumen aparecerá cuando el docente cierre las primeras clases.
            </p>
          </section>
        )}

        {progress.closedEnrollments.length > 0 ? (
          <ClosedEnrollmentsCard items={progress.closedEnrollments} />
        ) : (
          <section className="rounded-2xl border border-dashed border-border-strong bg-surface p-6">
            <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
              <History size={11} strokeWidth={1.6} />
              Histórico de niveles
            </div>
            <p className="text-[13px] text-text-3">
              Cuando completes tu primer nivel quedará archivado acá como parte
              de tu recorrido.
            </p>
          </section>
        )}
      </div>

      <section aria-labelledby="history-heading">
        <header className="mb-3 flex flex-wrap items-baseline gap-2">
          <History size={14} strokeWidth={1.6} className="text-text-3" />
          <h2
            id="history-heading"
            className="font-serif text-[20px] font-normal text-foreground"
          >
            Historial de clases
          </h2>
          <span className="text-[12.5px] text-text-3">
            {progress.history.length === 0
              ? "Sin clases registradas todavía."
              : `Últimas ${progress.history.length} registradas.`}
          </span>
        </header>
        {progress.history.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Aún no se cerró ninguna clase"
            description="Cuando el docente cierre tus primeras sesiones aparecerán acá con el tema y tu asistencia."
          />
        ) : (
          <ul className="space-y-2.5">
            {progress.history.map((item) => (
              <li key={item.sessionId}>
                <HistoryRow item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  )
}

// -----------------------------------------------------------------------------
//  Componentes
// -----------------------------------------------------------------------------

function ProgressHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-7 border-b border-border pb-6">
      <div>
        <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
          Académico
        </p>
        <h1 className="font-serif text-[36px] font-normal leading-[1.15] tracking-[-0.02em]">
          Mi progreso
        </h1>
        <p className="mt-2.5 max-w-[620px] text-[14.5px] text-text-2">
          {subtitle ??
            "Tu recorrido completo en CM English Instructor: horas dictadas, asistencia y registro de cada clase."}
        </p>
      </div>
    </header>
  )
}

function ActiveLevelCard({
  enrollment,
}: {
  enrollment: StudentProgressEnrollment
}) {
  const pct =
    enrollment.totalHours > 0
      ? Math.min(
          100,
          Math.round((enrollment.consumedHours / enrollment.totalHours) * 100),
        )
      : 0
  const remainingHours = Math.max(
    0,
    enrollment.totalHours - enrollment.consumedHours,
  )
  const remainingClasses =
    enrollment.classDurationMinutes > 0
      ? Math.ceil((remainingHours * 60) / enrollment.classDurationMinutes)
      : 0
  const attendancePct =
    enrollment.registeredCount > 0
      ? Math.round(
          (enrollment.attendedCount / enrollment.registeredCount) * 100,
        )
      : null

  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface to-bone-50 px-6 py-5 lg:py-6">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-teal-500 to-teal-700"
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-teal-700">
            <BookOpen size={11} strokeWidth={1.6} />
            Nivel actual
          </div>
          <h3 className="font-serif text-[26px] font-normal leading-[1.15] tracking-[-0.015em] text-foreground">
            {enrollment.programName}
          </h3>
          <div className="mt-1 text-[14.5px] text-text-2">
            {enrollment.levelName}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Tag>{MODALITY_LABEL[enrollment.modality] ?? enrollment.modality}</Tag>
            {enrollment.cefrLevelCode && (
              <Tag>CEFR {enrollment.cefrLevelCode}</Tag>
            )}
          </div>
          <HoursProgress
            label="Horas tomadas"
            consumed={enrollment.consumedHours}
            total={enrollment.totalHours}
            className="mt-5"
          />
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1.5 font-mono text-[12px] text-text-3">
            <span>
              {pct}% completado
            </span>
            <span aria-hidden>·</span>
            <span>
              {remainingHours.toFixed(1)} h restantes
            </span>
            {enrollment.classDurationMinutes > 0 && remainingClasses > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>
                  ≈ {remainingClasses}{" "}
                  {remainingClasses === 1 ? "clase" : "clases"} para cerrar
                </span>
              </>
            )}
          </div>
        </div>

        <dl className="space-y-3 border-t border-border/60 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <DLItem icon={CalendarDays} label="Inicio">
            {formatDate(enrollment.startedAt)}
          </DLItem>
          <DLItem icon={Clock} label="Última clase">
            {enrollment.lastAttendedAt
              ? formatDate(enrollment.lastAttendedAt)
              : "Aún sin clases registradas"}
          </DLItem>
          {enrollment.classGroup && (
            <>
              <DLItem icon={School} label="Aula">
                <span className="font-medium text-foreground">
                  {enrollment.classGroup.name}
                </span>
                {enrollment.classGroup.currentTeacher && (
                  <span className="block text-[12px] text-text-3">
                    Con {enrollment.classGroup.currentTeacher}
                  </span>
                )}
              </DLItem>
              <DLItem icon={CalendarDays} label="Horario">
                <div className="flex flex-wrap gap-1.5">
                  {enrollment.classGroup.slots.map((s, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[11.5px] text-text-2"
                    >
                      {DAYS_SHORT_ES[s.dayOfWeek]} {s.startTime}
                    </span>
                  ))}
                </div>
              </DLItem>
            </>
          )}
          {attendancePct !== null && (
            <DLItem icon={CalendarCheck} label="Tu asistencia">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="font-mono text-[13px] tabular-nums text-foreground">
                  {attendancePct}%
                </span>
                <span className="font-mono text-[11.5px] text-text-3">
                  {enrollment.attendedCount} de {enrollment.registeredCount}
                </span>
              </div>
              <ProgressBar
                value={attendancePct}
                variant={
                  attendancePct < 70
                    ? "warn"
                    : attendancePct >= 90
                      ? "default"
                      : "info"
                }
                bordered
              />
            </DLItem>
          )}
          {enrollment.rootFolderId && (
            <div className="pt-1">
              <Link
                href={
                  `/estudiante/materiales/${enrollment.rootFolderId}` as Route
                }
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12.5px] text-text-2 transition-colors hover:border-teal-500 hover:text-teal-500"
              >
                <FolderOpen size={12} strokeWidth={1.6} />
                Materiales del nivel
                <ArrowUpRight size={11} strokeWidth={1.6} />
              </Link>
            </div>
          )}
        </dl>
      </div>
    </article>
  )
}

function DLItem({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof CalendarDays
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[14px_1fr] items-baseline gap-3">
      <Icon
        size={12}
        strokeWidth={1.6}
        className="mt-0.5 self-start text-text-3"
      />
      <div>
        <dt className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-text-3">
          {label}
        </dt>
        <dd className="mt-0.5 text-[13.5px] text-foreground">{children}</dd>
      </div>
    </div>
  )
}

function ClosedEnrollmentsCard({
  items,
}: {
  items: StudentClosedEnrollment[]
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-[22px] py-[18px]">
        <h3 className="m-0 font-serif text-[20px] font-normal leading-[1.2] tracking-[-0.015em] text-foreground">
          Histórico de niveles
        </h3>
        <span className="font-mono text-[12px] tracking-[0.04em] text-text-3">
          {items.length} {items.length === 1 ? "registro" : "registros"}
        </span>
      </header>
      <ul>
        {items.map((e) => (
          <li
            key={e.enrollmentId}
            className="grid grid-cols-[1fr_auto] items-baseline gap-3 border-b border-border px-[22px] py-3.5 last:border-b-0"
          >
            <div className="min-w-0">
              <div className="truncate text-[14px] leading-[1.3] text-foreground">
                {e.programName}{" "}
                <span className="text-text-2">· {e.levelName}</span>
              </div>
              <div className="mt-0.5 font-mono text-[11.5px] tracking-[0.02em] text-text-3">
                {formatDate(e.startedAt)}
                {e.closedAt ? ` → ${formatDate(e.closedAt)}` : ""}
                {e.cefrLevelCode ? ` · ${e.cefrLevelCode}` : ""}
              </div>
            </div>
            <div className="text-right">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em]",
                  e.status === "COMPLETED"
                    ? "border-teal-500/35 bg-teal-500/[0.07] text-teal-700"
                    : e.status === "PAUSED"
                      ? "border-warning/35 bg-warning/[0.07] text-warning"
                      : "border-danger/35 bg-danger/[0.07] text-danger",
                )}
              >
                {CLOSED_LABEL[e.status]}
              </span>
              <div className="mt-1 font-mono text-[11.5px] tracking-[0.02em] text-text-3">
                {e.consumedHours.toFixed(1)} / {e.totalHours} h
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function HistoryRow({ item }: { item: StudentProgressHistoryItem }) {
  const isNoShow = item.sessionStatus === "NO_SHOW"
  const isPresent =
    item.attendance === "PRESENT" || item.attendance === "LATE"
  const isMissed =
    item.attendance === "ABSENT" || item.attendance === "EXCUSED"
  const accent = isNoShow
    ? "bg-warning/70"
    : isPresent
      ? "bg-teal-500/60"
      : isMissed
        ? "bg-danger/60"
        : "bg-border-strong/60"

  return (
    <article className="relative overflow-hidden rounded-xl border border-border bg-surface px-4 py-3.5 pl-5">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[140px] text-[12.5px] text-text-3">
          {formatDateLong(item.scheduledStart)}
          <div className="mt-0.5 font-mono text-[13px] tracking-[0.02em] text-text-2">
            {formatTime(item.scheduledStart)} – {formatTime(item.scheduledEnd)}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[14.5px] text-foreground">
            {item.topic ?? <span className="italic text-text-3">Sin tema cargado</span>}
          </div>
          <div className="mt-0.5 text-[12.5px] text-text-3">
            {item.classGroupName} · {item.durationMinutes} min
          </div>
          {item.homework && (
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.5] text-text-2">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">
                Tarea
              </span>
              {" — "}
              {item.homework}
            </p>
          )}
        </div>
        <AttendancePill item={item} />
      </div>
    </article>
  )
}

function AttendancePill({ item }: { item: StudentProgressHistoryItem }) {
  if (item.sessionStatus === "NO_SHOW") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/35 bg-warning/[0.07] px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] text-warning">
        Sin registro
      </span>
    )
  }
  const present =
    item.attendance === "PRESENT" || item.attendance === "LATE"
  const missed =
    item.attendance === "ABSENT" || item.attendance === "EXCUSED"
  const Icon = present ? Check : missed ? X : Clock
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em]",
        present
          ? "border-teal-500/35 bg-teal-500/[0.07] text-teal-700"
          : missed
            ? "border-danger/35 bg-danger/[0.07] text-danger"
            : "border-border bg-bone-50 text-text-3",
      )}
    >
      <Icon size={11} strokeWidth={1.6} />
      {ATTENDANCE_LABEL[item.attendance]}
    </span>
  )
}

// -----------------------------------------------------------------------------
//  Builders + helpers
// -----------------------------------------------------------------------------

function buildKpis(progress: StudentProgress): Kpi[] {
  const primary = progress.activeEnrollments[0] ?? null
  const hoursPct =
    primary && primary.totalHours > 0
      ? Math.round((primary.consumedHours / primary.totalHours) * 100)
      : null
  const attended = progress.attendance.present + progress.attendance.late
  const attendancePct =
    progress.attendance.registered > 0
      ? Math.round((attended / progress.attendance.registered) * 100)
      : null
  const completedLevels = progress.closedEnrollments.filter(
    (e) => e.status === "COMPLETED",
  ).length

  return [
    {
      label: "Horas tomadas",
      value: progress.totalHoursDictated.toFixed(1),
      unit: "h",
      icon: Clock,
      delta: primary
        ? { text: `${primary.consumedHours.toFixed(1)} h en el nivel actual` }
        : { text: "Histórico acumulado" },
    },
    {
      label: "Clases registradas",
      value: String(progress.attendance.registered),
      icon: CalendarDays,
      delta: { text: `${progress.history.length} en el historial` },
    },
    {
      label: "Asistencia",
      value: attendancePct !== null ? String(attendancePct) : "—",
      unit: attendancePct !== null ? "%" : undefined,
      icon: CalendarCheck,
      delta: buildAttendanceDelta(progress.attendance, attendancePct),
    },
    {
      label: "Nivel actual",
      value: hoursPct !== null ? String(hoursPct) : "—",
      unit: hoursPct !== null ? "%" : undefined,
      icon: TrendingUp,
      delta: primary
        ? {
            text: `${primary.programName} · ${primary.levelName}`,
          }
        : completedLevels > 0
          ? {
              text: `${completedLevels} ${completedLevels === 1 ? "nivel" : "niveles"} completados`,
            }
          : { text: "Sin matrícula activa" },
    },
  ]
}

function buildAttendanceRows(
  counts: StudentProgress["attendance"],
): LevelEntry[] {
  if (counts.registered === 0) return []
  const items: LevelEntry[] = []
  if (counts.present > 0) {
    items.push({
      id: "present",
      name: "Asististe",
      count: counts.present,
      total: counts.registered,
      variant: "default",
    })
  }
  if (counts.late > 0) {
    items.push({
      id: "late",
      name: "Llegaste tarde",
      count: counts.late,
      total: counts.registered,
      variant: "info",
    })
  }
  if (counts.excused > 0) {
    items.push({
      id: "excused",
      name: "Justificada",
      count: counts.excused,
      total: counts.registered,
      variant: "warn",
    })
  }
  if (counts.absent > 0) {
    items.push({
      id: "absent",
      name: "Faltaste",
      count: counts.absent,
      total: counts.registered,
      variant: "danger",
    })
  }
  return items
}

function buildAttendanceMeta(counts: StudentProgress["attendance"]): string {
  if (counts.registered === 0) return "Sin clases registradas"
  const attended = counts.present + counts.late
  const pct = Math.round((attended / counts.registered) * 100)
  return `${counts.registered} ${counts.registered === 1 ? "clase registrada" : "clases registradas"} · ${pct}% asistencia`
}

function buildAttendanceDelta(
  counts: StudentProgress["attendance"],
  pct: number | null,
): Kpi["delta"] {
  if (counts.registered === 0) return { text: "Sin clases registradas" }
  if (pct !== null && pct >= 85) {
    return {
      text: `${counts.present + counts.late} asistencias acumuladas`,
      variant: "up",
    }
  }
  if (pct !== null && pct < 70) {
    return { text: "Estás por debajo del 70%", variant: "warn" }
  }
  return { text: `${counts.present + counts.late} asistencias acumuladas` }
}

function buildSubtitle(progress: StudentProgress): string | undefined {
  const primary = progress.activeEnrollments[0]
  if (!primary) {
    if (progress.closedEnrollments.length > 0) {
      return `Tu recorrido acumula ${progress.totalHoursDictated.toFixed(1)} h dictadas. Cuando empieces un nuevo nivel vas a verlo acá.`
    }
    return undefined
  }
  return `Vas por ${primary.consumedHours.toFixed(1)} de ${primary.totalHours} h del ${primary.programName} · ${primary.levelName}. Acá tienes tu historial completo de clases y asistencia.`
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

function formatTime(d: Date): string {
  return timeFormatter.format(d)
}
