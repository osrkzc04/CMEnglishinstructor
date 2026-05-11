import { notFound } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import type { Metadata } from "next"
import { ArrowUpRight } from "lucide-react"
import { EnrollmentStatus } from "@prisma/client"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  getStudentFullDetail,
  type StudentEnrollmentDetail,
} from "@/modules/students/queries"
import { Tag } from "@/components/ui/tag"
import { ResendAccessLinkButton } from "@/components/auth/ResendAccessLinkButton"
import { HoursProgress } from "@/components/shared/HoursProgress"
import { StatusBadge } from "@/app/(admin)/admin/estudiantes/_components/StatusBadge"
import { PersonalDataForm } from "./_components/PersonalDataForm"
import { PreferredScheduleForm } from "./_components/PreferredScheduleForm"

export const metadata: Metadata = { title: "Estudiante" }

const DAYS_ES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
]

type RouteParams = { id: string }

export default async function EstudianteDetallePage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const { id } = await params

  const detail = await getStudentFullDetail(id)
  if (!detail) notFound()

  const activeEnrollment = detail.enrollments.find(
    (e) => e.status === EnrollmentStatus.ACTIVE,
  )
  const pastEnrollments = detail.enrollments.filter(
    (e) => e !== activeEnrollment,
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
        { label: "Admin", href: "/admin/dashboard" as Route },
        { label: "Estudiantes", href: "/admin/estudiantes" as Route },
        { label: `${detail.firstName} ${detail.lastName}` },
      ]}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
            Estudiante
          </p>
          <h1 className="font-serif text-[32px] font-normal leading-[1.18] tracking-[-0.02em]">
            {detail.firstName} {detail.lastName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-text-3">
            <span>{detail.email}</span>
            {detail.company && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {detail.company}
                  {detail.position && (
                    <span className="text-text-4"> · {detail.position}</span>
                  )}
                </span>
              </>
            )}
          </div>
        </div>
        <StatusBadge status={detail.status} />
      </header>

      {/* Matrícula vigente */}
      <section className="mb-6 rounded-xl border border-border bg-surface px-6 py-5">
        <header className="mb-4">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
            Operación
          </p>
          <h2 className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">
            Matrícula vigente
          </h2>
        </header>

        {activeEnrollment ? (
          <ActiveEnrollmentBlock enrollment={activeEnrollment} />
        ) : (
          <div className="rounded-md border border-border bg-surface-alt px-4 py-6 text-center">
            <p className="text-[13.5px] text-text-2">
              Sin matrícula vigente.
            </p>
            <p className="mt-1 text-[12.5px] text-text-3">
              {detail.enrollments.length === 0
                ? "Este estudiante todavía no fue matriculado."
                : "La matrícula anterior está cerrada."}
            </p>
          </div>
        )}
      </section>

      {/* Datos personales */}
      <section className="mb-6 rounded-xl border border-border bg-surface px-6 py-5">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
              Ficha
            </p>
            <h2 className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">
              Datos personales
            </h2>
          </div>
          {detail.status === "ACTIVE" && (
            <ResendAccessLinkButton userId={detail.id} />
          )}
        </header>
        <PersonalDataForm
          studentId={detail.id}
          initialValues={{
            firstName: detail.firstName,
            lastName: detail.lastName,
            email: detail.email,
            phone: detail.phone ?? undefined,
            document: detail.document ?? undefined,
            status: detail.status,
            company: detail.company ?? undefined,
            position: detail.position ?? undefined,
            notes: detail.notes ?? undefined,
          }}
        />
      </section>

      {/* Horario preferido */}
      <section className="mb-6 rounded-xl border border-border bg-surface px-6 py-5">
        <header className="mb-4">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
            Disponibilidad
          </p>
          <h2 className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">
            Horario semanal preferido
          </h2>
          <p className="mt-1 text-[13px] text-text-3">
            Bloques en los que el estudiante puede tomar clase. Se cruza con la
            disponibilidad del docente al armar el aula.
          </p>
        </header>
        <PreferredScheduleForm
          studentId={detail.id}
          initialBlocks={detail.preferredSchedule}
        />
      </section>

      {/* Histórico de matrículas */}
      {pastEnrollments.length > 0 && (
        <section className="rounded-xl border border-border bg-surface px-6 py-5">
          <header className="mb-4">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
              Histórico
            </p>
            <h2 className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">
              Matrículas anteriores
            </h2>
          </header>
          <ul className="space-y-3">
            {pastEnrollments.map((e) => (
              <li
                key={e.id}
                className="rounded-md border border-border bg-surface-alt px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13.5px] text-foreground">{e.programLabel}</p>
                  <span className="font-mono text-[12px] tracking-[0.02em] text-text-3">
                    {formatDate(e.createdAt)}
                    {e.closedAt && ` — ${formatDate(e.closedAt)}`}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-text-3">
                  {modalityLabel(e.modality)}
                  {e.classGroup && (
                    <>
                      <span className="text-text-4"> · </span>
                      Aula: {e.classGroup.name}
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  )
}

function ActiveEnrollmentBlock({
  enrollment,
}: {
  enrollment: StudentEnrollmentDetail
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-serif text-[18px] font-normal tracking-[-0.01em] text-foreground">
            {enrollment.programLabel}
          </p>
          <p className="mt-1 text-[12.5px] text-text-3">
            Alta {formatDate(enrollment.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {enrollment.cefrLevelCode && (
            <Tag>CEFR {enrollment.cefrLevelCode}</Tag>
          )}
          <Tag>{modalityLabel(enrollment.modality)}</Tag>
          <Tag>{enrollment.classDurationMinutes} min/clase</Tag>
        </div>
      </div>

      <HoursProgress
        label="Avance del nivel"
        consumed={enrollment.consumedHours}
        total={enrollment.totalHours}
        className="mt-4 max-w-md"
      />

      {enrollment.classGroup ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
              Aula
            </p>
            <p className="text-[14px] text-foreground">
              {enrollment.classGroup.name}
            </p>
            <Link
              href={`/admin/aulas/${enrollment.classGroup.id}` as Route}
              className="mt-1 inline-flex items-center gap-1 text-[12.5px] text-teal-500 hover:underline"
            >
              Ver aula
              <ArrowUpRight size={11} strokeWidth={1.6} />
            </Link>
          </div>
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
              Docente actual
            </p>
            {enrollment.classGroup.currentTeacher ? (
              <div className="text-[14px] text-foreground">
                {enrollment.classGroup.currentTeacher.teacherName}
                <p className="mt-0.5 text-[12px] text-text-3">
                  Desde {formatDate(enrollment.classGroup.currentTeacher.since)}
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-warning">Sin docente asignado</p>
            )}
          </div>
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
              Horario
            </p>
            <div className="flex flex-wrap gap-1.5">
              {enrollment.classGroup.slots.map((s) => (
                <span
                  key={`${s.dayOfWeek}-${s.startTime}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-alt px-2.5 py-1 text-[12px]"
                >
                  <span className="text-foreground">
                    {DAYS_ES[s.dayOfWeek]}
                  </span>
                  <span className="font-mono tracking-[0.02em] text-text-2">
                    {s.startTime}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-warning/40 bg-warning/[0.06] px-4 py-3 text-[13px] text-warning">
          Esta matrícula todavía no fue asignada a un aula. Coordinación debe
          ubicarla en un grupo del mismo nivel para que tenga horario y docente.
        </div>
      )}

      {enrollment.notes && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
            Notas
          </p>
          <p className="text-[13px] leading-[1.55] text-text-2">
            {enrollment.notes}
          </p>
        </div>
      )}
    </div>
  )
}

function modalityLabel(m: string): string {
  if (m === "VIRTUAL") return "Virtual"
  if (m === "PRESENCIAL") return "Presencial"
  if (m === "HIBRIDO") return "Híbrida"
  return m
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
