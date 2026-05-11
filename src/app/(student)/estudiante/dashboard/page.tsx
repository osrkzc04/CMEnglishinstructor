import type { Route } from "next"
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  Check,
  Clock,
  ExternalLink,
  GraduationCap,
  MapPin,
  School,
  TrendingUp,
  Video,
  X,
} from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { getSessionUser } from "@/modules/auth/queries"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  getStudentDashboard,
  type StudentDashboard,
  type StudentRecentSession,
} from "@/modules/students/queries"
import { KpiBand, type Kpi } from "@/components/dashboard/KpiBand"
import { StudentAgendaCard } from "@/components/dashboard/StudentAgendaCard"
import {
  ActivityCard,
  type ActivityEntry,
} from "@/components/dashboard/ActivityCard"
import {
  MyLevelCard,
  type MyLevelEntry,
} from "@/components/dashboard/MyLevelCard"
import { HomeworkCard } from "@/components/dashboard/HomeworkCard"
import { LevelsCard, type LevelEntry } from "@/components/dashboard/LevelsCard"
import { EmptyState } from "@/components/ui/empty-state"

const DAYS_SHORT_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

const MODALITY_LABEL: Record<string, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrida",
}

export default async function StudentDashboardPage() {
  const user = await getSessionUser()
  if (!user) return null

  const firstName = user.name?.split(" ")[0] ?? ""
  const dashboard = await getStudentDashboard(user.id)

  const primary = dashboard.enrollments[0] ?? null
  const kpis = buildKpis(dashboard, primary)
  const myLevels = buildLevelEntries(dashboard.enrollments)
  const activity = buildActivity(dashboard.recentSessions)
  const attendanceRows = buildAttendanceRows(dashboard.attendance)
  const meta = buildHeaderMeta(dashboard, primary)

  return (
    <AppShell
      role={user.role}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role),
      }}
      breadcrumbs={[
        { label: "Estudiante", href: "/estudiante/dashboard" as Route },
        { label: "Dashboard" },
      ]}
    >
      <header className="mb-8 flex flex-wrap items-end justify-between gap-7 border-b border-border pb-6">
        <div>
          <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
            {formatHeaderDate()}
          </p>
          <h1 className="font-serif text-[40px] font-normal leading-[1.15] tracking-[-0.02em]">
            Hola{firstName ? `, ${firstName}` : ""}
            <span className="font-light italic text-text-2"> — qué gusto verte.</span>
          </h1>
          <p className="mt-2.5 max-w-[560px] text-[15px] text-text-2">
            {buildSubtitle(dashboard, primary)}
          </p>
        </div>
        {meta && (
          <div className="text-right font-mono text-[12.5px] leading-[1.7] tracking-[0.04em] text-text-3">
            <div>{meta.label}</div>
            <div className="text-[14px] text-foreground">{meta.value}</div>
          </div>
        )}
      </header>

      {dashboard.enrollments.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Aún sin matrícula activa"
          description="Cuando coordinación publique tu matrícula vas a ver acá el programa, el horario y los materiales."
        />
      ) : (
        <>
          <KpiBand items={kpis} />

          <div className="mb-5 grid gap-5 xl:grid-cols-[1.7fr_1fr]">
            <StudentAgendaCard
              entries={dashboard.upcomingSessions}
              totalToday={dashboard.todaySessionCount}
            />
            <ActivityCard entries={activity} />
          </div>

          <div className="mb-4 grid gap-5 xl:grid-cols-2">
            <MyLevelCard entries={myLevels} />
            <HomeworkCard entries={dashboard.recentHomework} />
          </div>

          {primary?.classGroup && (
            <section
              aria-label="Mi aula"
              className="mb-5 rounded-2xl border border-border bg-surface px-5 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-1.5 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
                    <School size={11} strokeWidth={1.6} />
                    Mi aula
                  </div>
                  <div className="font-serif text-[20px] font-normal leading-[1.2] tracking-[-0.01em] text-foreground">
                    {primary.classGroup.name}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {primary.classGroup.slots.map((s, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-bone-50 px-2 py-0.5 font-mono text-[11.5px] text-text-2"
                      >
                        {DAYS_SHORT_ES[s.dayOfWeek]} {s.startTime}
                      </span>
                    ))}
                  </div>
                  {primary.classGroup.currentTeacher ? (
                    <p className="mt-2 text-[13px] text-text-2">
                      Docente:{" "}
                      <span className="font-medium text-foreground">
                        {primary.classGroup.currentTeacher.name}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-[13px] text-warning">
                      Pendiente de asignación de docente
                    </p>
                  )}
                </div>
                {dashboard.nextClass &&
                  dashboard.nextClass.meetingUrl &&
                  (dashboard.nextClass.modality === "VIRTUAL" ||
                    dashboard.nextClass.modality === "HIBRIDO") && (
                    <a
                      href={dashboard.nextClass.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-[13px] font-medium text-bone shadow-sm transition-colors hover:bg-teal-deep"
                    >
                      <Video size={13} strokeWidth={1.8} />
                      Conectar a la clase
                      <ExternalLink size={11} strokeWidth={1.8} />
                    </a>
                  )}
                {dashboard.nextClass &&
                  dashboard.nextClass.location &&
                  (dashboard.nextClass.modality === "PRESENCIAL" ||
                    dashboard.nextClass.modality === "HIBRIDO") && (
                    <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-alt px-3 py-1.5 text-[12.5px] text-text-2">
                      <MapPin size={12} strokeWidth={1.6} />
                      {dashboard.nextClass.location}
                    </div>
                  )}
              </div>
            </section>
          )}

          {attendanceRows.length > 0 ? (
            <LevelsCard
              items={attendanceRows}
              meta={buildAttendanceMeta(dashboard.attendance)}
            />
          ) : (
            <section
              aria-label="Asistencia"
              className="rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-alt text-text-3">
                <CalendarCheck size={20} strokeWidth={1.6} />
              </div>
              <h2 className="mt-3.5 font-serif text-[18px] italic font-light tracking-[-0.01em]">
                Aún sin asistencias registradas
              </h2>
              <p className="mx-auto mt-1 max-w-[420px] text-[13.5px] text-text-2">
                Cuando el docente cierre tus primeras clases vas a ver acá tu
                resumen de asistencia.
              </p>
            </section>
          )}
        </>
      )}
    </AppShell>
  )
}

// -----------------------------------------------------------------------------
//  Builders
// -----------------------------------------------------------------------------

function buildKpis(
  dashboard: StudentDashboard,
  primary: StudentDashboard["enrollments"][number] | null,
): Kpi[] {
  const hoursPct =
    primary && primary.totalHours > 0
      ? Math.round((primary.consumedHours / primary.totalHours) * 100)
      : null

  const attended = dashboard.attendance.present + dashboard.attendance.late
  const attendancePct =
    dashboard.attendance.registered > 0
      ? Math.round((attended / dashboard.attendance.registered) * 100)
      : null

  return [
    {
      label: "Tu avance",
      value: hoursPct !== null ? String(hoursPct) : "—",
      unit: hoursPct !== null ? "%" : undefined,
      icon: TrendingUp,
      delta: primary
        ? {
            text: `${primary.consumedHours.toFixed(1)} / ${primary.totalHours} h del nivel`,
          }
        : { text: "Sin matrícula activa" },
    },
    {
      label: "Próxima clase",
      value: dashboard.nextClass
        ? formatNextClassValue(dashboard.nextClass.scheduledStart)
        : "—",
      icon: CalendarClock,
      delta: dashboard.nextClass
        ? buildNextClassDelta(dashboard.nextClass)
        : { text: "Sin clases próximas" },
    },
    {
      label: "Esta semana",
      value: String(dashboard.weekSessionCount),
      unit: "clases",
      icon: Clock,
      delta:
        dashboard.todaySessionCount > 0
          ? {
              text: `${dashboard.todaySessionCount} ${dashboard.todaySessionCount === 1 ? "es hoy" : "son hoy"}`,
            }
          : { text: "Próximos 7 días" },
    },
    {
      label: "Asistencia",
      value: attendancePct !== null ? String(attendancePct) : "—",
      unit: attendancePct !== null ? "%" : undefined,
      icon: CalendarCheck,
      delta: buildAttendanceDelta(dashboard.attendance, attendancePct),
    },
  ]
}

function buildLevelEntries(
  enrollments: StudentDashboard["enrollments"],
): MyLevelEntry[] {
  return enrollments.map((e) => ({
    enrollmentId: e.enrollmentId,
    programName: e.programName,
    levelName: e.levelName,
    modality: e.modality,
    consumedHours: e.consumedHours,
    totalHours: e.totalHours,
    rootFolderId: e.rootFolderId,
  }))
}

function buildActivity(items: StudentRecentSession[]): ActivityEntry[] {
  return items.map((s) => {
    const isCompleted = s.sessionStatus === "COMPLETED"
    const isNoShow = s.sessionStatus === "NO_SHOW"
    const isPresent =
      s.attendance === "PRESENT" || s.attendance === "LATE"
    const isAbsent =
      s.attendance === "ABSENT" || s.attendance === "EXCUSED"

    const icon = isNoShow
      ? AlertTriangle
      : isPresent
        ? Check
        : isAbsent
          ? X
          : BookOpen
    const variant: ActivityEntry["variant"] = isNoShow
      ? "warn"
      : isPresent
        ? "default"
        : isAbsent
          ? "danger"
          : "default"

    const baseText = isNoShow
      ? "Clase sin registro"
      : isCompleted
        ? attendanceLabel(s.attendance)
        : "Clase cerrada"

    return {
      id: s.id,
      icon,
      variant,
      body: (
        <>
          {baseText} · <em>{s.classGroupName}</em>
          {s.topic ? ` · ${s.topic}` : ""}
        </>
      ),
      when: formatRelative(s.scheduledStart),
    }
  })
}

function attendanceLabel(
  attendance: StudentRecentSession["attendance"],
): string {
  switch (attendance) {
    case "PRESENT":
      return "Asististe"
    case "LATE":
      return "Llegaste tarde"
    case "ABSENT":
      return "Faltaste"
    case "EXCUSED":
      return "Falta justificada"
    default:
      return "Sin registrar"
  }
}

function buildAttendanceRows(counts: StudentDashboard["attendance"]): LevelEntry[] {
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

function buildAttendanceMeta(counts: StudentDashboard["attendance"]): string {
  if (counts.registered === 0) return "Sin clases registradas"
  const attended = counts.present + counts.late
  const pct = Math.round((attended / counts.registered) * 100)
  return `${counts.registered} ${counts.registered === 1 ? "clase registrada" : "clases registradas"} · ${pct}% asistencia`
}

function buildHeaderMeta(
  dashboard: StudentDashboard,
  primary: StudentDashboard["enrollments"][number] | null,
): { label: string; value: string } | null {
  if (dashboard.nextClass) {
    return {
      label: "Próxima clase",
      value: formatNextClassFull(dashboard.nextClass.scheduledStart),
    }
  }
  if (primary) {
    return {
      label: "Mi programa",
      value: primary.programName,
    }
  }
  return null
}

function buildSubtitle(
  dashboard: StudentDashboard,
  primary: StudentDashboard["enrollments"][number] | null,
): string {
  if (!primary) {
    return "Cuando coordinación publique tu matrícula vas a ver acá tu programa, agenda y materiales."
  }
  const parts: string[] = []
  if (dashboard.todaySessionCount > 0) {
    parts.push(
      `${dashboard.todaySessionCount} ${dashboard.todaySessionCount === 1 ? "clase hoy" : "clases hoy"}`,
    )
  } else if (dashboard.nextClass) {
    parts.push(
      `próxima clase ${formatNextClassShort(dashboard.nextClass.scheduledStart)}`,
    )
  }
  if (dashboard.attendance.registered > 0) {
    const attended = dashboard.attendance.present + dashboard.attendance.late
    const pct = Math.round((attended / dashboard.attendance.registered) * 100)
    parts.push(`${pct}% de asistencia`)
  }
  parts.push(
    `${primary.consumedHours.toFixed(1)} de ${primary.totalHours} h del ${MODALITY_LABEL[primary.modality]?.toLowerCase() ?? primary.modality} ${primary.levelName}`,
  )
  return capitalize(parts.join(" · ")) + "."
}

function buildAttendanceDelta(
  counts: StudentDashboard["attendance"],
  pct: number | null,
): Kpi["delta"] {
  if (counts.registered === 0) return { text: "Sin clases registradas" }
  if (pct !== null && pct >= 85) {
    return {
      text: `${counts.present + counts.late} de ${counts.registered} clases`,
      variant: "up",
    }
  }
  if (pct !== null && pct < 70) {
    return {
      text: `Estás por debajo del 70%`,
      variant: "warn",
    }
  }
  return {
    text: `${counts.present + counts.late} de ${counts.registered} clases`,
  }
}

function buildNextClassDelta(
  nextClass: NonNullable<StudentDashboard["nextClass"]>,
): Kpi["delta"] {
  const isLive =
    nextClass.scheduledStart.getTime() <= Date.now() &&
    Date.now() < nextClass.scheduledEnd.getTime()
  if (isLive) return { text: "En curso ahora", variant: "up" }
  const ms = nextClass.scheduledStart.getTime() - Date.now()
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return { text: `Empieza en ${minutes} min`, variant: "warn" }
  const hours = Math.round(minutes / 60)
  if (hours < 24) return { text: `Empieza en ${hours} h` }
  const days = Math.round(hours / 24)
  return { text: `Empieza en ${days} ${days === 1 ? "día" : "días"}` }
}

// -----------------------------------------------------------------------------
//  Helpers de fecha
// -----------------------------------------------------------------------------

function formatHeaderDate(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat("es-EC", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Guayaquil",
  })
  const parts = formatter.formatToParts(now)
  const find = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  const weekday = find("weekday")
  const day = find("day")
  const month = find("month").replace(".", "")
  const year = find("year")
  return `${capitalize(weekday)} · ${day} ${month} ${year}`
}

function capitalize(s: string): string {
  if (s.length === 0) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const nextClassValueFormatter = new Intl.DateTimeFormat("es-EC", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Guayaquil",
})

const nextClassFullFormatter = new Intl.DateTimeFormat("es-EC", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Guayaquil",
})

const nextClassShortFormatter = new Intl.DateTimeFormat("es-EC", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Guayaquil",
})

function formatNextClassValue(start: Date): string {
  return nextClassValueFormatter.format(start)
}

function formatNextClassFull(start: Date): string {
  return nextClassFullFormatter.format(start).replace(/\./g, "")
}

function formatNextClassShort(start: Date): string {
  return nextClassShortFormatter.format(start).replace(/\./g, "")
}

const relativeShortFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Guayaquil",
})

function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime()
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return "ahora"
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 7) return `hace ${days} ${days === 1 ? "día" : "días"}`
  return relativeShortFormatter.format(d).replace(/\./g, "")
}
