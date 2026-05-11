import type { Route } from "next"
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  School,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { getSessionUser } from "@/modules/auth/queries"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  getTeacherDashboard,
  type TeacherActivityItem,
  type TeacherLevelDistribution,
  type TeacherTodaySession,
} from "@/modules/teachers/queries"
import { KpiBand, type Kpi } from "@/components/dashboard/KpiBand"
import { TeacherAgendaCard } from "@/components/dashboard/TeacherAgendaCard"
import { ActivityCard, type ActivityEntry } from "@/components/dashboard/ActivityCard"
import { TeacherPendingsCard } from "@/components/dashboard/TeacherPendingsCard"
import { MyAulasCard, type MyAulaRow } from "@/components/dashboard/MyAulasCard"
import { LevelsCard, type LevelEntry } from "@/components/dashboard/LevelsCard"
import { EmptyState } from "@/components/ui/empty-state"

export default async function TeacherDashboardPage() {
  const user = await getSessionUser()
  if (!user) return null

  const firstName = user.name?.split(" ")[0] ?? ""
  const dashboard = await getTeacherDashboard(user.id)

  const kpis = buildKpis(dashboard)
  const aulas = buildAulasRows(dashboard.classGroups)
  const levels = buildLevels(dashboard.levelDistribution, dashboard.studentCount)
  const activity = buildActivity(dashboard.recentActivity)

  return (
    <AppShell
      role={user.role}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role),
      }}
      breadcrumbs={[
        { label: "Docente", href: "/docente/dashboard" as Route },
        { label: "Dashboard" },
      ]}
    >
      <header className="border-border mb-8 flex flex-wrap items-end justify-between gap-7 border-b pb-6">
        <div>
          <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
            {formatHeaderDate()}
          </p>
          <h1 className="font-serif text-[40px] leading-[1.15] font-normal tracking-[-0.02em]">
            Buen día, {firstName || "docente"}
            <span className="text-text-2 font-light italic"> — empezamos.</span>
          </h1>
          <p className="text-text-2 mt-2.5 max-w-[560px] text-[15px]">{buildSubtitle(dashboard)}</p>
        </div>
        <div className="text-text-3 text-right font-mono text-[12.5px] leading-[1.7] tracking-[0.04em]">
          <div>Esta semana</div>
          <div className="text-foreground text-[14px]">
            {dashboard.weekSessionCount} {dashboard.weekSessionCount === 1 ? "clase" : "clases"}
          </div>
        </div>
      </header>

      <KpiBand items={kpis} />

      <div className="mb-5 grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <TeacherAgendaCard
          entries={dashboard.todaySessions}
          totalToday={dashboard.todaySessionCount}
        />
        <ActivityCard entries={activity} />
      </div>

      <div className="mb-4 grid gap-5 xl:grid-cols-2">
        <TeacherPendingsCard items={dashboard.pendings} />
        <MyAulasCard items={aulas} />
      </div>

      {levels.length > 0 ? (
        <LevelsCard
          items={levels}
          meta={`${dashboard.studentCount} ${dashboard.studentCount === 1 ? "estudiante activo" : "estudiantes activos"}`}
        />
      ) : (
        <section className="border-border-strong bg-surface rounded-2xl border border-dashed p-8 text-center">
          <div className="border-border bg-surface-alt text-text-3 mx-auto flex h-12 w-12 items-center justify-center rounded-full border">
            <School size={20} strokeWidth={1.6} />
          </div>
          <h2 className="mt-3.5 font-serif text-[18px] font-light tracking-[-0.01em] italic">
            Sin alumnos activos
          </h2>
          <p className="text-text-2 mx-auto mt-1 max-w-[420px] text-[13.5px]">
            Cuando coordinación matricule alumnos en tus aulas, vas a ver la distribución por nivel
            acá.
          </p>
        </section>
      )}

      {dashboard.classGroups.length === 0 && (
        <div className="mt-5">
          <EmptyState
            icon={School}
            title="Aún sin aulas asignadas"
            description="Cuando coordinación te asigne a un aula, vas a verla acá con su horario y estudiantes."
          />
        </div>
      )}
    </AppShell>
  )
}

// -----------------------------------------------------------------------------
//  Builders de datos para los cards
// -----------------------------------------------------------------------------

function buildKpis(dashboard: Awaited<ReturnType<typeof getTeacherDashboard>>): Kpi[] {
  const next = dashboard.nextClass
  return [
    {
      label: "Aulas activas",
      value: String(dashboard.classGroupCount),
      icon: School,
      delta: {
        text:
          dashboard.classGroupCount === 0
            ? "Sin asignaciones vigentes"
            : `${dashboard.studentCount} ${dashboard.studentCount === 1 ? "alumno" : "alumnos"} en total`,
      },
    },
    {
      label: "Clases hoy",
      value: String(dashboard.todaySessionCount),
      icon: CalendarClock,
      delta: buildTodayDelta(dashboard.todaySessions),
    },
    {
      label: "Esta semana",
      value: String(dashboard.weekSessionCount),
      unit: "clases",
      icon: Clock,
      delta: next
        ? { text: `Próxima · ${formatNextClassDelta(next.scheduledStart)}` }
        : { text: "Sin clases próximas" },
    },
    {
      label: "Pendientes",
      value: String(dashboard.pendingCount),
      icon: AlertTriangle,
      delta:
        dashboard.pendingCount === 0
          ? { text: "Estás al día", variant: "up" }
          : {
              text: `${dashboard.pendingCount} ${dashboard.pendingCount === 1 ? "clase necesita atención" : "clases necesitan atención"}`,
              variant: "warn",
            },
    },
  ]
}

function buildTodayDelta(sessions: TeacherTodaySession[]): Kpi["delta"] {
  if (sessions.length === 0) return { text: "Sin clases hoy" }
  let live = 0
  let scheduled = 0
  let closed = 0
  for (const s of sessions) {
    if (s.status === "live") live += 1
    else if (s.status === "scheduled") scheduled += 1
    else if (s.status === "completed") closed += 1
  }
  const parts: string[] = []
  if (live > 0) parts.push(`${live} en curso`)
  if (scheduled > 0) parts.push(`${scheduled} por iniciar`)
  if (closed > 0) parts.push(`${closed} cerrada${closed === 1 ? "" : "s"}`)
  return { text: parts.join(" · ") }
}

function buildAulasRows(
  groups: Awaited<ReturnType<typeof getTeacherDashboard>>["classGroups"],
): MyAulaRow[] {
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    programLabel: g.programLabel,
    studentCount: g.studentCount,
    consumedHours: g.avgConsumedHours,
    totalHours: g.totalHours,
  }))
}

function buildLevels(distribution: TeacherLevelDistribution[], total: number): LevelEntry[] {
  if (total === 0) return []
  // Agrupamos por banda CEFR — A* básico, B* intermedio, C* avanzado, null sin
  // nivel. Sirve para una vista de alto nivel coherente con el dashboard admin.
  const buckets = {
    basico: { count: 0, programs: new Set<string>() },
    intermedio: { count: 0, programs: new Set<string>() },
    avanzado: { count: 0, programs: new Set<string>() },
    sin: { count: 0, programs: new Set<string>() },
  }
  for (const d of distribution) {
    const cefr = d.cefrLevelCode ?? ""
    const bucket = cefr.startsWith("A")
      ? buckets.basico
      : cefr.startsWith("B")
        ? buckets.intermedio
        : cefr.startsWith("C")
          ? buckets.avanzado
          : buckets.sin
    bucket.count += d.count
    bucket.programs.add(d.programName)
  }
  const items: LevelEntry[] = []
  if (buckets.basico.count > 0) {
    items.push({
      id: "basico",
      name: "Principiante",
      tag: "A1 · A2",
      count: buckets.basico.count,
      total,
      variant: "info",
    })
  }
  if (buckets.intermedio.count > 0) {
    items.push({
      id: "intermedio",
      name: "Intermedio",
      tag: "B1 · B2",
      count: buckets.intermedio.count,
      total,
      variant: "default",
    })
  }
  if (buckets.avanzado.count > 0) {
    items.push({
      id: "avanzado",
      name: "Avanzado",
      tag: "C1 · C2",
      count: buckets.avanzado.count,
      total,
      variant: "warn",
    })
  }
  if (buckets.sin.count > 0) {
    items.push({
      id: "sin",
      name: "Sin CEFR",
      tag: "general / kids",
      count: buckets.sin.count,
      total,
      variant: "danger",
    })
  }
  return items
}

function buildActivity(items: TeacherActivityItem[]): ActivityEntry[] {
  return items.map((it) => {
    const icon =
      it.kind === "completed"
        ? Check
        : it.kind === "cancelled"
          ? X
          : it.kind === "no_show"
            ? AlertTriangle
            : UserPlus
    const variant: ActivityEntry["variant"] =
      it.kind === "completed"
        ? "default"
        : it.kind === "cancelled"
          ? "danger"
          : it.kind === "no_show"
            ? "warn"
            : "teal"
    return {
      id: it.id,
      icon,
      variant,
      body: (
        <>
          {it.detail}
          {it.classGroupName && (
            <>
              {" "}
              · <em>{it.classGroupName}</em>
            </>
          )}
        </>
      ),
      when: formatRelative(it.at),
    }
  })
}

function buildSubtitle(dashboard: Awaited<ReturnType<typeof getTeacherDashboard>>): string {
  if (dashboard.classGroupCount === 0) {
    return "Aún sin aulas asignadas. Cuando coordinación te ubique en un grupo, vas a ver toda tu operación acá."
  }
  const todayPart =
    dashboard.todaySessionCount === 0
      ? "sin clases hoy"
      : `${dashboard.todaySessionCount} ${dashboard.todaySessionCount === 1 ? "clase hoy" : "clases hoy"}`
  const pendingPart =
    dashboard.pendingCount === 0
      ? "nada pendiente"
      : `${dashboard.pendingCount} ${dashboard.pendingCount === 1 ? "pendiente por cerrar" : "pendientes por cerrar"}`
  const studentsPart = `${dashboard.studentCount} ${dashboard.studentCount === 1 ? "alumno activo" : "alumnos activos"}`
  return `${todayPart} · ${pendingPart} · ${studentsPart}.`
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
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatNextClassDelta(scheduledStart: Date): string {
  const ms = scheduledStart.getTime() - Date.now()
  if (ms <= 0) return "en curso"
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `en ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `en ${hours} h`
  const days = Math.round(hours / 24)
  return `en ${days} ${days === 1 ? "día" : "días"}`
}

const relativeShortFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Guayaquil",
})

function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime()
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return "hace instantes"
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 7) return `hace ${days} ${days === 1 ? "día" : "días"}`
  return relativeShortFormatter.format(d).replace(/\./g, "")
}
