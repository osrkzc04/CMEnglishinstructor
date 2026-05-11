import { notFound } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import type { Metadata } from "next"
import { ArrowUpRight } from "lucide-react"
import { ClassGroupStatus } from "@prisma/client"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  getClassGroupDetail,
  getClassGroupSessionsSummary,
  listEligibleEnrollmentsForGroup,
} from "@/modules/classGroups/queries"
import { findCandidatesForClassGroup } from "@/modules/classGroups/eligibility"
import { Tag } from "@/components/ui/tag"
import { StatusBadge } from "@/app/(admin)/admin/aulas/_components/StatusBadge"
import { MetadataForm } from "./_components/MetadataForm"
import { TeacherCard } from "./_components/TeacherCard"
import { EnrollmentsCard } from "./_components/EnrollmentsCard"
import { SessionsCard } from "./_components/SessionsCard"
import { StatusActions } from "./_components/StatusActions"

export const metadata: Metadata = { title: "Aula" }

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

const MODALITY_LABEL: Record<string, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrida",
}

type RouteParams = { id: string }

export default async function AulaDetallePage({ params }: { params: Promise<RouteParams> }) {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const { id } = await params

  const detail = await getClassGroupDetail(id)
  if (!detail) notFound()

  // Datos para los diálogos de acción — los pre-cargamos en server para que
  // el dialog se abra al instante sin round-trip.
  const isActive = detail.status === ClassGroupStatus.ACTIVE
  const [candidates, eligibleEnrollments, sessionsSummary] = isActive
    ? await Promise.all([
        findCandidatesForClassGroup({ classGroupId: id }),
        listEligibleEnrollmentsForGroup(id),
        getClassGroupSessionsSummary(id),
      ])
    : [null, [], await getClassGroupSessionsSummary(id)]

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
        { label: "Aulas", href: "/admin/aulas" as Route },
        { label: detail.name },
      ]}
    >
      <header className="mb-7">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">Aula</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
            {detail.name}
          </h1>
          <StatusBadge status={detail.status} />
        </div>
        <div className="text-text-3 mt-2 flex flex-wrap items-baseline gap-2.5 text-[13.5px]">
          <span>{detail.programLevel.programLabel}</span>
          <span aria-hidden>·</span>
          <span>{MODALITY_LABEL[detail.modality]}</span>
          <span aria-hidden>·</span>
          <span>{detail.programLevel.classDurationMinutes} min/clase</span>
          {detail.programLevel.cefrLevelCode && <Tag>CEFR {detail.programLevel.cefrLevelCode}</Tag>}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {/* Metadatos */}
          <Card title="Datos del aula">
            <MetadataForm
              classGroupId={detail.id}
              initialValues={{
                name: detail.name,
                notes: detail.notes ?? undefined,
                defaultMeetingUrl: detail.defaultMeetingUrl ?? undefined,
                defaultLocation: detail.defaultLocation ?? undefined,
              }}
              modality={detail.modality}
              disabled={!isActive}
            />
          </Card>

          {/* Horario */}
          <Card title="Horario semanal">
            {detail.slots.length === 0 ? (
              <p className="text-text-3 text-[13px]">Sin bloques cargados.</p>
            ) : (
              <ul className="divide-border divide-y">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const slots = detail.slots.filter((s) => s.dayOfWeek === d)
                  if (slots.length === 0) return null
                  return (
                    <li
                      key={d}
                      className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-2.5 first:pt-0 last:pb-0"
                    >
                      <span className="text-foreground text-[13.5px] font-medium">
                        {DAYS_ES[d]}
                      </span>
                      <span className="text-text-2 font-mono text-[13px] tracking-[0.02em]">
                        {slots
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                          .map((s) => formatSlotRange(s.startTime, s.durationMinutes))
                          .join("  ·  ")}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {/* Docente */}
          <Card title="Docente">
            <TeacherCard
              classGroupId={detail.id}
              currentAssignment={detail.currentAssignment}
              pastAssignments={detail.pastAssignments}
              candidates={candidates?.candidates ?? []}
              canEdit={isActive}
            />
          </Card>

          {/* Alumnos */}
          <Card title="Alumnos">
            <EnrollmentsCard
              classGroupId={detail.id}
              enrollments={detail.enrollments}
              eligibleEnrollments={eligibleEnrollments}
              canEdit={isActive}
            />
          </Card>

          {/* Sesiones programadas */}
          <Card title="Sesiones programadas">
            <SessionsCard
              classGroupId={detail.id}
              summary={sessionsSummary}
              canSchedule={isActive}
              hasTeacher={detail.currentAssignment !== null}
            />
          </Card>
        </div>

        <aside className="space-y-5">
          <Card title="Información">
            <dl className="space-y-2.5">
              <DLItem label="Creada">{formatDate(detail.createdAt)}</DLItem>
              {detail.closedAt && <DLItem label="Cerrada">{formatDate(detail.closedAt)}</DLItem>}
              <DLItem label="Slots">{detail.slots.length}</DLItem>
              <DLItem label="Alumnos">{detail.enrollments.length}</DLItem>
            </dl>
            <div className="border-border mt-4 border-t pt-3">
              <Link
                href={`/admin/aulas?programLevelId=${detail.programLevel.id}` as Route}
                className="inline-flex items-center gap-1 text-[12.5px] text-teal-500 hover:underline"
              >
                Ver otras aulas de este nivel
                <ArrowUpRight size={11} strokeWidth={1.6} />
              </Link>
            </div>
          </Card>

          <StatusActions classGroupId={detail.id} status={detail.status} />
        </aside>
      </div>
    </AppShell>
  )
}

// -----------------------------------------------------------------------------
//  Sub-componentes locales
// -----------------------------------------------------------------------------

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-border bg-surface rounded-xl border p-5 lg:p-6">
      <h2 className="text-foreground mb-4 font-serif text-[18px] font-normal tracking-[-0.01em]">
        {title}
      </h2>
      {children}
    </section>
  )
}

function DLItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-3">
      <dt className="text-text-3 text-[12px] font-medium tracking-[0.06em] uppercase">{label}</dt>
      <dd className="text-foreground text-[13.5px]">{children}</dd>
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

function formatDate(d: Date): string {
  return dateFormatter.format(d).replace(/\./g, "")
}
