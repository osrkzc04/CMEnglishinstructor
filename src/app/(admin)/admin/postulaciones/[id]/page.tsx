import { notFound } from "next/navigation"
import type { Route } from "next"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getApplicationFullDetail } from "@/modules/teachers/applications/queries"
import { StatusBadge } from "@/app/(admin)/admin/postulaciones/_components/StatusBadge"
import { ApplicationActions } from "./_components/ApplicationActions"

/**
 * Detalle de una postulación. Centraliza la lectura completa + las
 * acciones (aprobar / rechazar / editar / eliminar). Las acciones viven en
 * un componente cliente; el resto es Server Component para que el contenido
 * se hidrate ya filtrado y autorizado.
 */

export const metadata: Metadata = {
  title: "Detalle de postulación",
}

type Props = { params: Promise<{ id: string }> }

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

export default async function PostulacionDetallePage({ params }: Props) {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const { id } = await params
  const detail = await getApplicationFullDetail(id)
  if (!detail) notFound()

  const fullName = `${detail.firstName} ${detail.lastName}`
  const levelsByLanguage = groupBy(detail.levels, (l) => l.languageName)
  const availabilityByDay = groupBy(detail.availability, (a) => String(a.dayOfWeek))

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
        {
          label: "Postulaciones",
          href: "/admin/postulaciones" as Route,
        },
        { label: fullName },
      ]}
    >
      <header className="mb-7">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Postulación
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
            {fullName}
          </h1>
          <StatusBadge status={detail.status} />
        </div>
        {detail.status === "APPROVED" && detail.userId && (
          <Link
            href={`/admin/docentes/${detail.userId}` as Route}
            className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] text-teal-500 hover:underline"
          >
            Ver perfil del docente
            <ArrowUpRight size={13} strokeWidth={1.6} />
          </Link>
        )}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {/* Datos del postulante */}
          <Card title="Datos del postulante">
            <DefinitionList>
              <DLItem label="Correo">{detail.email}</DLItem>
              <DLItem label="Teléfono">{detail.phone}</DLItem>
              <DLItem label="Documento">{detail.document}</DLItem>
            </DefinitionList>
          </Card>

          {/* Niveles */}
          <Card title="Niveles que puede impartir">
            {detail.levels.length === 0 ? (
              <p className="text-text-3 text-[13.5px]">El postulante no marcó ningún nivel.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(levelsByLanguage).map(([lang, levels]) => (
                  <div key={lang}>
                    <p className="text-text-3 mb-2 text-[12px] font-medium tracking-[0.08em] uppercase">
                      {lang}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {levels.map((l) => (
                        <span
                          key={l.id}
                          className="border-border bg-surface-alt text-foreground inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12.5px]"
                        >
                          <span className="font-mono text-[12px] tracking-[0.04em] text-teal-500">
                            {l.code}
                          </span>
                          <span className="text-text-2">·</span>
                          <span>{l.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Disponibilidad */}
          <Card title="Disponibilidad propuesta">
            {detail.availability.length === 0 ? (
              <p className="text-text-3 text-[13.5px]">
                El postulante no marcó ningún bloque de disponibilidad.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                  const blocks = availabilityByDay[String(dayIdx)] ?? []
                  if (blocks.length === 0) return null
                  return (
                    <li
                      key={dayIdx}
                      className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-2.5 first:pt-0 last:pb-0"
                    >
                      <span className="text-foreground text-[13.5px] font-medium">
                        {DAYS_ES[dayIdx]}
                      </span>
                      <span className="text-text-2 font-mono text-[13px] tracking-[0.02em]">
                        {blocks
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                          .map((b) => `${b.startTime}–${b.endTime}`)
                          .join("  ·  ")}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {/* Bio */}
          {detail.bio && (
            <Card title="Experiencia">
              <p className="text-text-2 text-[14px] leading-[1.65] whitespace-pre-wrap">
                {detail.bio}
              </p>
            </Card>
          )}

          {/* Motivo de rechazo */}
          {detail.status === "REJECTED" && detail.rejectionReason && (
            <Card title="Motivo del rechazo" tone="danger">
              <p className="text-text-2 text-[14px] leading-[1.65] whitespace-pre-wrap">
                {detail.rejectionReason}
              </p>
            </Card>
          )}
        </div>

        <aside className="space-y-5">
          <Card title="Información">
            <DefinitionList>
              <DLItem label="Recibida">{formatDateTime(detail.createdAt)}</DLItem>
              {detail.consentAcceptedAt && (
                <DLItem label="Consentimiento">{formatDateTime(detail.consentAcceptedAt)}</DLItem>
              )}
              {detail.reviewedAt && (
                <DLItem label="Revisada">{formatDateTime(detail.reviewedAt)}</DLItem>
              )}
              {detail.reviewer && <DLItem label="Por">{detail.reviewer.name}</DLItem>}
            </DefinitionList>
          </Card>

          <ApplicationActions
            applicationId={detail.id}
            status={detail.status}
            applicantName={fullName}
            teacherUserId={detail.userId}
          />
        </aside>
      </div>
    </AppShell>
  )
}

// -----------------------------------------------------------------------------
//  Sub-componentes locales
// -----------------------------------------------------------------------------

function Card({
  title,
  tone,
  children,
}: {
  title: string
  tone?: "default" | "danger"
  children: React.ReactNode
}) {
  const isDanger = tone === "danger"
  return (
    <section
      className={
        isDanger
          ? "border-danger/30 bg-surface rounded-xl border p-5 lg:p-6"
          : "border-border bg-surface rounded-xl border p-5 lg:p-6"
      }
    >
      <h2
        className={
          "mb-4 font-serif text-[18px] font-normal tracking-[-0.01em] " +
          (isDanger ? "text-danger" : "text-foreground")
        }
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function DefinitionList({ children }: { children: React.ReactNode }) {
  return <dl className="space-y-2.5">{children}</dl>
}

function DLItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-3">
      <dt className="text-text-3 text-[12px] font-medium tracking-[0.06em] uppercase">{label}</dt>
      <dd className="text-foreground text-[13.5px]">{children}</dd>
    </div>
  )
}

// Group helper sin lodash.
function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const item of items) {
    const k = key(item)
    if (!out[k]) out[k] = []
    out[k]!.push(item)
  }
  return out
}

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
})

function formatDateTime(d: Date): string {
  return dateFormatter.format(d).replace(/\./g, "")
}
