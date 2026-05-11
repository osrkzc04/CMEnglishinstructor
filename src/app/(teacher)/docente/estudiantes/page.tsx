import type { Route } from "next"
import type { Metadata } from "next"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  Mail,
  Phone,
  School,
  Users,
} from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  listTeacherStudents,
  type TeacherStudentRow,
} from "@/modules/teachers/queries"
import { Avatar } from "@/components/ui/avatar"
import { HoursProgress } from "@/components/shared/HoursProgress"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Tag } from "@/components/ui/tag"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Mis estudiantes" }

const MODALITY_LABEL: Record<string, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrida",
}

export default async function TeacherEstudiantesPage({
  searchParams,
}: {
  searchParams: Promise<{ aula?: string }>
}) {
  const user = await requireRole(["TEACHER"])
  const params = await searchParams
  const aulaFilter = params.aula?.trim() ? params.aula.trim() : undefined

  const { rows, classGroups } = await listTeacherStudents(user.id, {
    classGroupId: aulaFilter,
  })

  const aulasCount = new Set(rows.map((r) => r.classGroup.id)).size
  const atRiskHours = rows.filter(
    (r) => r.totalHours > 0 && r.consumedHours / r.totalHours >= 0.8,
  ).length
  const lowAttendance = rows.filter((r) => {
    if (r.registeredCount === 0) return false
    return r.attendedCount / r.registeredCount < 0.7
  }).length

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
        { label: "Mis estudiantes" },
      ]}
    >
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
            Mi día
          </p>
          <h1 className="font-serif text-[32px] font-normal leading-[1.18] tracking-[-0.02em]">
            Mis estudiantes
          </h1>
          <p className="mt-2 max-w-[620px] text-[14px] leading-[1.55] text-text-3">
            Quiénes están en tus aulas, cómo van con las horas y su asistencia.
            Las alertas en amarillo marcan a quienes ya están cerca del fin del
            nivel o tienen asistencia baja.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[12.5px] tracking-[0.04em] text-text-3">
          <span>
            {rows.length} {rows.length === 1 ? "estudiante" : "estudiantes"}
          </span>
          <span aria-hidden>·</span>
          <span>
            {aulasCount} {aulasCount === 1 ? "aula" : "aulas"}
          </span>
        </div>
      </header>

      {rows.length > 0 && (atRiskHours > 0 || lowAttendance > 0) && (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {atRiskHours > 0 && (
            <AlertCard
              icon={AlertTriangle}
              label="Cerca del fin del nivel"
              count={atRiskHours}
              description="alumnos consumieron ≥80% de sus horas"
            />
          )}
          {lowAttendance > 0 && (
            <AlertCard
              icon={AlertTriangle}
              label="Asistencia baja"
              count={lowAttendance}
              description="alumnos asisten a menos del 70% de sus clases"
            />
          )}
        </div>
      )}

      {classGroups.length > 1 && (
        <AulaFilter classGroups={classGroups} activeId={aulaFilter ?? null} />
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin estudiantes en este recorte"
          description={
            aulaFilter
              ? "No hay estudiantes activos en el aula seleccionada. Cambiá el filtro para verlos todos."
              : "Cuando coordinación matricule alumnos en tus aulas, vas a verlos acá."
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.enrollmentId}>
              <StudentCard row={r} />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}

// -----------------------------------------------------------------------------
//  Componentes
// -----------------------------------------------------------------------------

function AulaFilter({
  classGroups,
  activeId,
}: {
  classGroups: { id: string; name: string }[]
  activeId: string | null
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
        Filtrar por aula
      </span>
      <Link
        href={"/docente/estudiantes" as Route}
        className={cn(
          "rounded-full border px-3 py-1 font-mono text-[11.5px] tracking-[0.02em] transition-colors",
          activeId === null
            ? "border-teal-500/40 bg-teal-500/[0.07] text-teal-700"
            : "border-border bg-surface text-text-2 hover:border-teal-500 hover:text-teal-500",
        )}
      >
        Todos
      </Link>
      {classGroups.map((g) => (
        <Link
          key={g.id}
          href={`/docente/estudiantes?aula=${g.id}` as Route}
          className={cn(
            "rounded-full border px-3 py-1 font-mono text-[11.5px] tracking-[0.02em] transition-colors",
            activeId === g.id
              ? "border-teal-500/40 bg-teal-500/[0.07] text-teal-700"
              : "border-border bg-surface text-text-2 hover:border-teal-500 hover:text-teal-500",
          )}
        >
          {g.name}
        </Link>
      ))}
    </div>
  )
}

function AlertCard({
  icon: Icon,
  label,
  count,
  description,
}: {
  icon: typeof AlertTriangle
  label: string
  count: number
  description: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/35 bg-warning/[0.05] px-4 py-3">
      <Icon size={18} strokeWidth={1.6} className="mt-0.5 shrink-0 text-warning" />
      <div className="min-w-0">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-warning">
          {label}
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="font-serif text-[22px] font-normal leading-none tracking-[-0.01em] text-foreground">
            {count}
          </span>
          <span className="text-[12.5px] text-text-2">{description}</span>
        </div>
      </div>
    </div>
  )
}

function StudentCard({ row }: { row: TeacherStudentRow }) {
  const initials = computeInitials(row.studentName)
  const hoursPct =
    row.totalHours > 0
      ? Math.min(100, Math.round((row.consumedHours / row.totalHours) * 100))
      : 0
  const hoursWarn = hoursPct >= 80
  const attendancePct =
    row.registeredCount > 0
      ? Math.round((row.attendedCount / row.registeredCount) * 100)
      : null
  const attendanceLow = attendancePct !== null && attendancePct < 70

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-xl border bg-surface px-4 py-4 pl-5 transition-colors",
        hoursWarn || attendanceLow
          ? "border-warning/30 hover:border-warning/50"
          : "border-border hover:border-border-strong",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          hoursWarn || attendanceLow ? "bg-warning/70" : "bg-border-strong/60",
        )}
      />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center">
        <div className="flex items-start gap-3">
          <Avatar size="md" initials={initials} />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-[15px] leading-[1.2] text-foreground">
              {row.studentName}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-text-3">
              <a
                href={`mailto:${row.studentEmail}`}
                className="inline-flex items-center gap-1.5 hover:text-teal-500"
              >
                <Mail size={11} strokeWidth={1.6} />
                {row.studentEmail}
              </a>
              {row.studentPhone && (
                <a
                  href={`tel:${row.studentPhone}`}
                  className="inline-flex items-center gap-1.5 hover:text-teal-500"
                >
                  <Phone size={11} strokeWidth={1.6} />
                  {row.studentPhone}
                </a>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-text-3">
              <Link
                href={`/docente/aulas/${row.classGroup.id}` as Route}
                className="inline-flex items-center gap-1 text-text-2 transition-colors hover:text-teal-500"
              >
                <School size={11} strokeWidth={1.6} />
                {row.classGroup.name}
                <ArrowUpRight size={10} strokeWidth={1.6} />
              </Link>
              <span aria-hidden>·</span>
              <span>{row.programLabel}</span>
              <span aria-hidden>·</span>
              <span>{row.levelName}</span>
              <Tag>{MODALITY_LABEL[row.modality] ?? row.modality}</Tag>
            </div>
          </div>
        </div>

        <div>
          <HoursProgress
            label="Horas"
            consumed={row.consumedHours}
            total={row.totalHours}
            size="sm"
          />
          {hoursWarn && (
            <p className="mt-1 text-[11.5px] text-warning">
              Cerca del fin del nivel
            </p>
          )}
        </div>

        <div>
          {attendancePct === null ? (
            <div className="font-mono text-[12px] text-text-3">
              Sin clases registradas todavía
            </div>
          ) : (
            <>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
                  Asistencia
                </span>
                <span
                  className={cn(
                    "font-mono text-[12px] tabular-nums",
                    attendanceLow ? "text-warning" : "text-foreground",
                  )}
                >
                  {attendancePct}%
                </span>
              </div>
              <ProgressBar
                value={attendancePct}
                variant={attendanceLow ? "warn" : "default"}
                bordered
              />
              <p className="mt-1.5 font-mono text-[11.5px] text-text-3">
                {row.attendedCount} asistencias · {row.absentCount} faltas
                {row.excusedCount > 0
                  ? ` · ${row.excusedCount} justificadas`
                  : ""}
              </p>
            </>
          )}
        </div>
      </div>
    </article>
  )
}

function computeInitials(fullName: string): string {
  const parts = fullName.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "—"
  if (parts.length === 1) {
    return (parts[0]?.slice(0, 2) ?? "").toUpperCase()
  }
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}
