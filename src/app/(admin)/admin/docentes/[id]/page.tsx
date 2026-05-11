import { notFound } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import type { Metadata } from "next"
import { ArrowRight } from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  getTeacherFullDetail,
  listCefrLevelsByLanguage,
  type TeacherAssignmentRow,
} from "@/modules/teachers/queries"
import { Tag } from "@/components/ui/tag"
import { ResendAccessLinkButton } from "@/components/auth/ResendAccessLinkButton"
import { StatusBadge } from "@/app/(admin)/admin/docentes/_components/StatusBadge"
import { PersonalDataForm } from "./_components/PersonalDataForm"
import { TeachableLevelsForm } from "./_components/TeachableLevelsForm"
import { AvailabilityForm } from "./_components/AvailabilityForm"

export const metadata: Metadata = { title: "Docente" }

type RouteParams = { id: string }

export default async function DocenteDetallePage({ params }: { params: Promise<RouteParams> }) {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const { id } = await params

  const [detail, cefrGroups] = await Promise.all([
    getTeacherFullDetail(id),
    listCefrLevelsByLanguage(),
  ])
  if (!detail) notFound()

  const currentAssignments = detail.assignments.filter((a) => a.isCurrent)
  const pastAssignments = detail.assignments.filter((a) => !a.isCurrent)

  return (
    <AppShell
      role={user.role!}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role!),
      }}
      breadcrumbs={[
        { label: "Admin", href: "/admin/dashboard" as Route },
        { label: "Docentes", href: "/admin/docentes" as Route },
        { label: `${detail.firstName} ${detail.lastName}` },
      ]}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
            Docente
          </p>
          <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
            {detail.firstName} {detail.lastName}
          </h1>
          <div className="text-text-3 mt-2 flex flex-wrap items-center gap-3 text-[13px]">
            <span>{detail.email}</span>
          </div>
        </div>
        <StatusBadge status={detail.status} />
      </header>

      <section className="border-border bg-surface mb-6 rounded-xl border px-6 py-5">
        <header className="mb-4">
          <h2 className="text-foreground font-serif text-[22px] font-normal tracking-[-0.01em]">
            Asignaciones vigentes
          </h2>
        </header>
        {currentAssignments.length === 0 ? (
          <div className="border-border bg-surface-alt rounded-md border px-4 py-6 text-center">
            <p className="text-text-2 text-[13.5px]">Sin asignaciones vigentes.</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {currentAssignments.map((a) => (
              <AssignmentRow key={a.id} a={a} />
            ))}
          </ul>
        )}
      </section>

      <section className="border-border bg-surface mb-6 rounded-xl border px-6 py-5">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-foreground font-serif text-[22px] font-normal tracking-[-0.01em]">
            Datos personales
          </h2>
          {detail.status === "ACTIVE" && <ResendAccessLinkButton userId={detail.id} />}
        </header>
        <PersonalDataForm
          teacherId={detail.id}
          initialValues={{
            firstName: detail.firstName,
            lastName: detail.lastName,
            email: detail.email,
            phone: detail.phone ?? undefined,
            document: detail.document ?? undefined,
            status: detail.status,
          }}
        />
      </section>

      <section className="border-border bg-surface mb-6 rounded-xl border px-6 py-5">
        <header className="mb-4">
          <h2 className="text-foreground font-serif text-[22px] font-normal tracking-[-0.01em]">
            Niveles que puede dictar
          </h2>
        </header>
        <TeachableLevelsForm
          teacherId={detail.id}
          initialLevelIds={detail.levelIds}
          groups={cefrGroups}
        />
      </section>

      <section className="border-border bg-surface mb-6 rounded-xl border px-6 py-5">
        <header className="mb-4">
          <h2 className="text-foreground font-serif text-[22px] font-normal tracking-[-0.01em]">
            Horario semanal
          </h2>
        </header>
        <AvailabilityForm
          teacherId={detail.id}
          initialBlocks={detail.availability.map((a) => ({
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
          }))}
        />
      </section>

      {pastAssignments.length > 0 && (
        <section className="border-border bg-surface rounded-xl border px-6 py-5">
          <header className="mb-4">
            <h2 className="text-foreground font-serif text-[22px] font-normal tracking-[-0.01em]">
              Aulas anteriores
            </h2>
          </header>
          <ul className="space-y-1.5">
            {pastAssignments.map((a) => (
              <li
                key={a.id}
                className="border-border flex flex-wrap items-baseline justify-between gap-3 border-b pb-2 text-[13px] last:border-b-0 last:pb-0"
              >
                <div>
                  <Link
                    href={`/admin/aulas/${a.classGroupId}` as Route}
                    className="text-foreground hover:text-teal-500"
                  >
                    {a.classGroupName}
                  </Link>
                  <span className="text-text-3 ml-2 text-[12.5px]">· {a.programLabel}</span>
                </div>
                <span className="text-text-3 font-mono text-[12px] tracking-[0.02em]">
                  {formatDate(a.startDate)} — {a.endDate ? formatDate(a.endDate) : "vigente"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  )
}

function AssignmentRow({ a }: { a: TeacherAssignmentRow }) {
  return (
    <li className="border-border bg-surface-alt flex flex-wrap items-baseline justify-between gap-3 rounded-md border px-4 py-3">
      <div>
        <Link
          href={`/admin/aulas/${a.classGroupId}` as Route}
          className="text-foreground text-[14px] hover:text-teal-500"
        >
          {a.classGroupName}
        </Link>
        <p className="text-text-3 mt-0.5 text-[12.5px]">
          {a.programLabel}
          <span className="text-text-4"> · </span>
          {a.studentCount} {a.studentCount === 1 ? "estudiante" : "estudiantes"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Tag>Desde {formatDate(a.startDate)}</Tag>
        <Link
          href={`/admin/aulas/${a.classGroupId}` as Route}
          className="text-text-3 inline-flex items-center gap-1 text-[12.5px] transition-colors hover:text-teal-500"
        >
          Ver aula
          <ArrowRight size={12} strokeWidth={1.6} />
        </Link>
      </div>
    </li>
  )
}

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Guayaquil",
})

function formatDate(d: Date): string {
  return dateFormatter.format(d).replace(/\./g, "")
}
