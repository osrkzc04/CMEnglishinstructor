import type { Route } from "next"
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ClipboardCheck,
  FileCheck,
  FileText,
  Plus,
  TrendingUp,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { getSessionUser } from "@/modules/auth/queries"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  getAdminDashboard,
  type AdminActivityItem,
  type AdminDashboard,
  type AdminLevelDistribution,
  type AdminPendingApplication,
  type AdminTeacherLoad,
} from "@/modules/admin/queries"
import { KpiBand, type Kpi } from "@/components/dashboard/KpiBand"
import { AdminAgendaCard } from "@/components/dashboard/AdminAgendaCard"
import { ActivityCard, type ActivityEntry } from "@/components/dashboard/ActivityCard"
import { PendingsCard, type Pending } from "@/components/dashboard/PendingsCard"
import { TeacherLoadCard, type TeacherLoad } from "@/components/dashboard/TeacherLoadCard"
import { LevelsCard, type LevelEntry } from "@/components/dashboard/LevelsCard"

export default async function AdminDashboardPage() {
  const user = await getSessionUser()
  if (!user) return null
  const firstName = user.name?.split(" ")[0] ?? "Carolina"

  const dashboard = await getAdminDashboard()

  const kpis = buildKpis(dashboard)
  const pendings = buildPendings(dashboard.pendingApplications)
  const teacherLoad = buildTeacherLoad(dashboard.teacherLoad)
  const levels = buildLevels(dashboard.levels)
  const activity = buildActivity(dashboard.recentActivity)

  return (
    <AppShell
      role={user.role}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role),
      }}
      breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" as Route }, { label: "Dashboard" }]}
      cta={{
        label: "Nueva clase",
        icon: <Plus size={14} strokeWidth={1.6} />,
      }}
    >
      <header className="border-border mb-8 flex flex-wrap items-end justify-between gap-7 border-b pb-6">
        <div>
          <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
            {formatHeaderDate()}
          </p>
          <h1 className="font-serif text-[40px] leading-[1.15] font-normal tracking-[-0.02em]">
            Buen día, {firstName}
            <span className="text-text-2 font-light italic"> — acá está hoy.</span>
          </h1>
          <p className="text-text-2 mt-2.5 max-w-[560px] text-[15px]">{buildSubtitle(dashboard)}</p>
        </div>
        <div className="text-text-3 text-right font-mono text-[12.5px] leading-[1.7] tracking-[0.04em]">
          <div>Ciclo activo</div>
          <div className="text-foreground text-[14px]">{formatCycle()}</div>
        </div>
      </header>

      <KpiBand items={kpis} />

      <div className="mb-5 grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <AdminAgendaCard
          entries={dashboard.agenda}
          totalToday={dashboard.kpis.todaySessions.total}
          totalTeachers={dashboard.totalTeachersToday}
        />
        <ActivityCard entries={activity} />
      </div>

      <div className="mb-4 grid gap-5 xl:grid-cols-2">
        <PendingsCard items={pendings} />
        <TeacherLoadCard
          items={teacherLoad}
          meta={`Esta semana · ${dashboard.activeTeachersCount} activos`}
        />
      </div>

      {levels.length > 0 ? (
        <LevelsCard
          items={levels}
          meta={`${dashboard.kpis.activeEnrollments} ${
            dashboard.kpis.activeEnrollments === 1 ? "matrícula activa" : "matrículas activas"
          }`}
        />
      ) : (
        <section className="border-border-strong bg-surface rounded-2xl border border-dashed p-8 text-center">
          <div className="border-border bg-surface-alt text-text-3 mx-auto flex h-12 w-12 items-center justify-center rounded-full border">
            <UsersRound size={20} strokeWidth={1.6} />
          </div>
          <h2 className="mt-3.5 font-serif text-[18px] font-light tracking-[-0.01em] italic">
            Sin matrículas activas
          </h2>
          <p className="text-text-2 mx-auto mt-1 max-w-[420px] text-[13.5px]">
            Cuando publiques las primeras matrículas vas a ver acá la distribución por nivel CEFR.
          </p>
        </section>
      )}
    </AppShell>
  )
}

// -----------------------------------------------------------------------------
//  Builders
// -----------------------------------------------------------------------------

function buildKpis(dashboard: AdminDashboard): Kpi[] {
  const today = dashboard.kpis.todaySessions
  const todayDeltaParts: string[] = []
  if (today.live > 0) todayDeltaParts.push(`${today.live} en curso`)
  if (today.scheduled > 0) todayDeltaParts.push(`${today.scheduled} por iniciar`)
  if (today.completed > 0)
    todayDeltaParts.push(`${today.completed} cerrada${today.completed === 1 ? "" : "s"}`)
  if (today.cancelled > 0)
    todayDeltaParts.push(`${today.cancelled} cancelada${today.cancelled === 1 ? "" : "s"}`)

  return [
    {
      label: "Estudiantes activos",
      value: String(dashboard.kpis.activeStudents),
      icon: UsersRound,
      delta:
        dashboard.kpis.activeEnrollments > 0
          ? {
              text: `${dashboard.kpis.activeEnrollments} ${
                dashboard.kpis.activeEnrollments === 1 ? "matrícula activa" : "matrículas activas"
              }`,
            }
          : { text: "Sin matrículas activas" },
    },
    {
      label: "Clases hoy",
      value: String(today.total),
      icon: CalendarClock,
      delta:
        todayDeltaParts.length > 0
          ? { text: todayDeltaParts.join(" · ") }
          : { text: "Sin clases hoy" },
    },
    {
      label: "Postulaciones",
      value: String(dashboard.kpis.pendingApplications),
      unit: "pendientes",
      icon: FileText,
      delta:
        dashboard.kpis.pendingApplications > 0
          ? {
              text: `${dashboard.kpis.pendingApplications} ${
                dashboard.kpis.pendingApplications === 1
                  ? "esperando revisión"
                  : "esperando revisión"
              }`,
              variant: "warn",
            }
          : { text: "Nada en cola", variant: "up" },
    },
    {
      label: "Ocupación docente",
      value:
        dashboard.kpis.teacherUtilizationPct !== null
          ? String(dashboard.kpis.teacherUtilizationPct)
          : "—",
      unit: dashboard.kpis.teacherUtilizationPct !== null ? "%" : undefined,
      icon: TrendingUp,
      delta:
        dashboard.kpis.teacherUtilizationPct === null
          ? { text: "Sin disponibilidad cargada" }
          : dashboard.kpis.teacherUtilizationPct >= 85
            ? {
                text: `${dashboard.activeTeachersCount} docentes activos · ya casi al tope`,
                variant: "warn",
              }
            : dashboard.kpis.teacherUtilizationPct < 50
              ? {
                  text: `${dashboard.activeTeachersCount} docentes activos · capacidad libre`,
                  variant: "default",
                }
              : {
                  text: `${dashboard.activeTeachersCount} docentes activos`,
                  variant: "up",
                },
    },
  ]
}

function buildPendings(items: AdminPendingApplication[]): Pending[] {
  return items.map((p) => ({
    id: p.id,
    initials: p.initials,
    name: p.fullName,
    detail: `Docente · ${p.levelsLabel} · ${formatRelative(p.createdAt)}`,
    status: "new",
    href: `/admin/postulaciones/${p.id}`,
  }))
}

function buildTeacherLoad(items: AdminTeacherLoad[]): TeacherLoad[] {
  return items.map((t) => ({
    id: t.id,
    initials: t.initials,
    name: t.fullName,
    level: t.cefrLabel,
    hours: t.hours,
    capacity: t.capacity,
  }))
}

function buildLevels(items: AdminLevelDistribution[]): LevelEntry[] {
  const variantById: Record<AdminLevelDistribution["id"], LevelEntry["variant"]> = {
    basico: "info",
    intermedio: "default",
    avanzado: "warn",
    sin: "danger",
  }
  return items.map((l) => ({
    id: l.id,
    name: l.name,
    tag: l.tag,
    count: l.count,
    total: l.total,
    variant: variantById[l.id],
  }))
}

function buildActivity(items: AdminActivityItem[]): ActivityEntry[] {
  return items.map((it) => {
    const { icon, variant } = activityIconVariant(it.kind)
    const link = it.href
    const body = link ? (
      <>
        <a href={link}>
          <em>{it.primary}</em>
        </a>
        {it.secondary ? <> · {it.secondary}</> : null}
      </>
    ) : (
      <>
        <em>{it.primary}</em>
        {it.secondary ? <> · {it.secondary}</> : null}
      </>
    )
    return {
      id: it.id,
      icon,
      variant,
      body,
      when: formatRelative(it.at),
    }
  })
}

function activityIconVariant(kind: AdminActivityItem["kind"]): {
  icon: ActivityEntry["icon"]
  variant: ActivityEntry["variant"]
} {
  switch (kind) {
    case "application_new":
      return { icon: FileCheck, variant: "teal" }
    case "application_approved":
      return { icon: Check, variant: "teal" }
    case "application_rejected":
      return { icon: X, variant: "danger" }
    case "enrollment_new":
      return { icon: UserPlus, variant: "teal" }
    case "session_completed":
      return { icon: Check, variant: "default" }
    case "session_cancelled":
      return { icon: X, variant: "danger" }
    case "session_no_show":
      return { icon: AlertTriangle, variant: "warn" }
    case "test_submitted":
      return { icon: ClipboardCheck, variant: "default" }
  }
}

function buildSubtitle(dashboard: AdminDashboard): string {
  const parts: string[] = []
  if (dashboard.kpis.pendingApplications > 0) {
    parts.push(
      `${dashboard.kpis.pendingApplications} ${
        dashboard.kpis.pendingApplications === 1
          ? "postulación esperando revisión"
          : "postulaciones esperando revisión"
      }`,
    )
  }
  if (dashboard.kpis.todaySessions.total > 0) {
    parts.push(
      `${dashboard.kpis.todaySessions.total} ${
        dashboard.kpis.todaySessions.total === 1 ? "clase programada hoy" : "clases programadas hoy"
      }`,
    )
  }
  if (parts.length === 0) {
    return "Sin alertas operativas hoy. Buen momento para revisar materiales o cerrar pendientes."
  }
  return parts.join(", ") + "."
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

function formatCycle(): string {
  const now = new Date()
  const guayaquil = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  const year = guayaquil.getUTCFullYear()
  const month = guayaquil.getUTCMonth() + 1 // 1..12
  const semester = month <= 6 ? "I" : "II"
  return `${year} — ${semester}`
}

function capitalize(s: string): string {
  if (s.length === 0) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const relativeFallbackFormatter = new Intl.DateTimeFormat("es-EC", {
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
  if (days === 1) return "ayer"
  if (days < 7) return `hace ${days} días`
  return relativeFallbackFormatter.format(d).replace(/\./g, "")
}
