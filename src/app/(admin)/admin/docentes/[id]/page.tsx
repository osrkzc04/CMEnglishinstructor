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

export default async function DocenteDetallePage({
  params,
}: {
  params: Promise<RouteParams>
}) {
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
          <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
            Docente
          </p>
          <h1 className="font-serif text-[32px] font-normal leading-[1.18] tracking-[-0.02em]">
            {detail.firstName} {detail.lastName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-text-3">
            <span>{detail.email}</span>
          </div>
        </div>
        <StatusBadge status={detail.status} />
      </header>

      <section className="mb-6 rounded-xl border border-border bg-surface px-6 py-5">
        <header className="mb-4">
          <h2 className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">
            Asignaciones vigentes
          </h2>
        </header>
        {currentAssignments.length === 0 ? (
          <div className="rounded-md border border-border bg-surface-alt px-4 py-6 text-center">
            <p className="text-[13.5px] text-text-2">
              Sin asignaciones vigentes.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {currentAssignments.map((a) => (
              <AssignmentRow key={a.id} a={a} />
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-border bg-surface px-6 py-5">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">
            Datos personales
          </h2>
          {detail.status === "ACTIVE" && (
            <ResendAccessLinkButton userId={detail.id} />
          )}
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

      <section className="mb-6 rounded-xl border border-border bg-surface px-6 py-5">
        <header className="mb-4">
          <h2 className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">
            Niveles que puede dictar
          </h2>
        </header>
        <TeachableLevelsForm
          teacherId={detail.id}
          initialLevelIds={detail.levelIds}
          groups={cefrGroups}
        />
      </section>

      <section className="mb-6 rounded-xl border border-border bg-surface px-6 py-5">
        <header className="mb-4">
          <h2 className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">
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
        <section className="rounded-xl border border-border bg-surface px-6 py-5">
          <header className="mb-4">
            <h2 className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">
              Aulas anteriores
            </h2>
          </header>
          <ul className="space-y-1.5">
            {pastAssignments.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-2 text-[13px] last:border-b-0 last:pb-0"
              >
                <div>
                  <Link
                    href={`/admin/aulas/${a.classGroupId}` as Route}
                    className="text-foreground hover:text-teal-500"
                  >
                    {a.classGroupName}
                  </Link>
                  <span className="ml-2 text-[12.5px] text-text-3">
                    · {a.programLabel}
                  </span>
                </div>
                <span className="font-mono text-[12px] tracking-[0.02em] text-text-3">
                  {formatDate(a.startDate)} —{" "}
                  {a.endDate ? formatDate(a.endDate) : "vigente"}
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
    <li className="flex flex-wrap items-baseline justify-between gap-3 rounded-md border border-border bg-surface-alt px-4 py-3">
      <div>
        <Link
          href={`/admin/aulas/${a.classGroupId}` as Route}
          className="text-[14px] text-foreground hover:text-teal-500"
        >
          {a.classGroupName}
        </Link>
        <p className="mt-0.5 text-[12.5px] text-text-3">
          {a.programLabel}
          <span className="text-text-4"> · </span>
          {a.studentCount}{" "}
          {a.studentCount === 1 ? "estudiante" : "estudiantes"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Tag>Desde {formatDate(a.startDate)}</Tag>
        <Link
          href={`/admin/aulas/${a.classGroupId}` as Route}
          className="inline-flex items-center gap-1 text-[12.5px] text-text-3 transition-colors hover:text-teal-500"
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
