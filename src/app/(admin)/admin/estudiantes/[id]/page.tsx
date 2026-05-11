import { notFound } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import type { Metadata } from "next"
import { ArrowUpRight } from "lucide-react"
import { EnrollmentStatus } from "@prisma/client"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getStudentFullDetail, type StudentEnrollmentDetail } from "@/modules/students/queries"
import { Tag } from "@/components/ui/tag"
import { ResendAccessLinkButton } from "@/components/auth/ResendAccessLinkButton"
import { HoursProgress } from "@/components/shared/HoursProgress"
import { StatusBadge } from "@/app/(admin)/admin/estudiantes/_components/StatusBadge"
import { PersonalDataForm } from "./_components/PersonalDataForm"
import { PreferredScheduleForm } from "./_components/PreferredScheduleForm"

export const metadata: Metadata = { title: "Estudiante" }

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

type RouteParams = { id: string }

export default async function EstudianteDetallePage({ params }: { params: Promise<RouteParams> }) {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const { id } = await params

  const detail = await getStudentFullDetail(id)
  if (!detail) notFound()

  const activeEnrollment = detail.enrollments.find((e) => e.status === EnrollmentStatus.ACTIVE)
  const pastEnrollments = detail.enrollments.filter((e) => e !== activeEnrollment)

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
          <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
            Estudiante
          </p>
          <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
            {detail.firstName} {detail.lastName}
          </h1>
          <div className="text-text-3 mt-2 flex flex-wrap items-center gap-3 text-[13px]">
            <span>{detail.email}</span>
            {detail.company && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {detail.company}
                  {detail.position && <span className="text-text-4"> · {detail.position}</span>}
                </span>
              </>
            )}
          </div>
        </div>
        <StatusBadge status={detail.status} />
      </header>

      {/* Matrícula vigente */}
      <section className="border-border bg-surface mb-6 rounded-xl border px-6 py-5">
        <header className="mb-4">
          <p className="text-text-3 mb-1 font-mono text-[11px] tracking-[0.08em] uppercase">
            Operación
          </p>
          <h2 className="text-foreground font-serif text-[22px] font-normal tracking-[-0.01em]">
            Matrícula vigente
          </h2>
        </header>

        {activeEnrollment ? (
          <ActiveEnrollmentBlock enrollment={activeEnrollment} />
        ) : (
          <div className="border-border bg-surface-alt rounded-md border px-4 py-6 text-center">
            <p className="text-text-2 text-[13.5px]">Sin matrícula vigente.</p>
            <p className="text-text-3 mt-1 text-[12.5px]">
              {detail.enrollments.length === 0
                ? "Este estudiante todavía no fue matriculado."
                : "La matrícula anterior está cerrada."}
            </p>
          </div>
        )}
      </section>

      {/* Datos personales */}
      <section className="border-border bg-surface mb-6 rounded-xl border px-6 py-5">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-text-3 mb-1 font-mono text-[11px] tracking-[0.08em] uppercase">
              Ficha
            </p>
            <h2 className="text-foreground font-serif text-[22px] font-normal tracking-[-0.01em]">
              Datos personales
            </h2>
          </div>
          {detail.status === "ACTIVE" && <ResendAccessLinkButton userId={detail.id} />}
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
      <section className="border-border bg-surface mb-6 rounded-xl border px-6 py-5">
        <header className="mb-4">
          <p className="text-text-3 mb-1 font-mono text-[11px] tracking-[0.08em] uppercase">
            Disponibilidad
          </p>
          <h2 className="text-foreground font-serif text-[22px] font-normal tracking-[-0.01em]">
            Horario semanal preferido
          </h2>
          <p className="text-text-3 mt-1 text-[13px]">
            Bloques en los que el estudiante puede tomar clase. Se cruza con la disponibilidad del
            docente al armar el aula.
          </p>
        </header>
        <PreferredScheduleForm studentId={detail.id} initialBlocks={detail.preferredSchedule} />
      </section>

      {/* Histórico de matrículas */}
      {pastEnrollments.length > 0 && (
        <section className="border-border bg-surface rounded-xl border px-6 py-5">
          <header className="mb-4">
            <p className="text-text-3 mb-1 font-mono text-[11px] tracking-[0.08em] uppercase">
              Histórico
            </p>
            <h2 className="text-foreground font-serif text-[22px] font-normal tracking-[-0.01em]">
              Matrículas anteriores
            </h2>
          </header>
          <ul className="space-y-3">
            {pastEnrollments.map((e) => (
              <li key={e.id} className="border-border bg-surface-alt rounded-md border px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-foreground text-[13.5px]">{e.programLabel}</p>
                  <span className="text-text-3 font-mono text-[12px] tracking-[0.02em]">
                    {formatDate(e.createdAt)}
                    {e.closedAt && ` — ${formatDate(e.closedAt)}`}
                  </span>
                </div>
                <p className="text-text-3 mt-1 text-[12.5px]">
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

function ActiveEnrollmentBlock({ enrollment }: { enrollment: StudentEnrollmentDetail }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-foreground font-serif text-[18px] font-normal tracking-[-0.01em]">
            {enrollment.programLabel}
          </p>
          <p className="text-text-3 mt-1 text-[12.5px]">Alta {formatDate(enrollment.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {enrollment.cefrLevelCode && <Tag>CEFR {enrollment.cefrLevelCode}</Tag>}
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
            <p className="text-text-3 mb-2 font-mono text-[11px] tracking-[0.08em] uppercase">
              Aula
            </p>
            <p className="text-foreground text-[14px]">{enrollment.classGroup.name}</p>
            <Link
              href={`/admin/aulas/${enrollment.classGroup.id}` as Route}
              className="mt-1 inline-flex items-center gap-1 text-[12.5px] text-teal-500 hover:underline"
            >
              Ver aula
              <ArrowUpRight size={11} strokeWidth={1.6} />
            </Link>
          </div>
          <div>
            <p className="text-text-3 mb-2 font-mono text-[11px] tracking-[0.08em] uppercase">
              Docente actual
            </p>
            {enrollment.classGroup.currentTeacher ? (
              <div className="text-foreground text-[14px]">
                {enrollment.classGroup.currentTeacher.teacherName}
                <p className="text-text-3 mt-0.5 text-[12px]">
                  Desde {formatDate(enrollment.classGroup.currentTeacher.since)}
                </p>
              </div>
            ) : (
              <p className="text-warning text-[13px]">Sin docente asignado</p>
            )}
          </div>
          <div>
            <p className="text-text-3 mb-2 font-mono text-[11px] tracking-[0.08em] uppercase">
              Horario
            </p>
            <div className="flex flex-wrap gap-1.5">
              {enrollment.classGroup.slots.map((s) => (
                <span
                  key={`${s.dayOfWeek}-${s.startTime}`}
                  className="border-border bg-surface-alt inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px]"
                >
                  <span className="text-foreground">{DAYS_ES[s.dayOfWeek]}</span>
                  <span className="text-text-2 font-mono tracking-[0.02em]">{s.startTime}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="border-warning/40 bg-warning/[0.06] text-warning mt-4 rounded-md border px-4 py-3 text-[13px]">
          Esta matrícula todavía no fue asignada a un aula. Coordinación debe ubicarla en un grupo
          del mismo nivel para que tenga horario y docente.
        </div>
      )}

      {enrollment.notes && (
        <div className="border-border mt-4 border-t pt-3">
          <p className="text-text-3 mb-1 font-mono text-[11px] tracking-[0.08em] uppercase">
            Notas
          </p>
          <p className="text-text-2 text-[13px] leading-[1.55]">{enrollment.notes}</p>
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
