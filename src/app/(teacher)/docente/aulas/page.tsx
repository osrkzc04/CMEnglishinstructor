import type { Route } from "next"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, School, Users, Video } from "lucide-react"
import { ClassGroupStatus } from "@prisma/client"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  listTeacherClassGroups,
  type TeacherClassGroupListItem,
} from "@/modules/classGroups/queries"
import { Tag } from "@/components/ui/tag"
import { EmptyState } from "@/components/ui/empty-state"

export const metadata: Metadata = { title: "Mis aulas" }

const DAYS_SHORT_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

const MODALITY_LABEL: Record<string, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrida",
}

const STATUS_TONE: Record<ClassGroupStatus, { label: string; className: string }> = {
  ACTIVE: {
    label: "Activa",
    className: "border-teal-500/40 bg-teal-500/10 text-teal-700",
  },
  COMPLETED: {
    label: "Cerrada",
    className: "border-border bg-bone-50 text-text-3",
  },
  CANCELLED: {
    label: "Cancelada",
    className: "border-danger/30 bg-danger/5 text-danger",
  },
}

export default async function TeacherAulasPage() {
  const user = await requireRole(["TEACHER"])
  const groups = await listTeacherClassGroups(user.id)

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
        { label: "Mis aulas" },
      ]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">Mi día</p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Mis aulas
        </h1>
        <p className="text-text-3 mt-2 text-[14px] leading-[1.55]">
          Los grupos que estás dictando ahora. Entra a cada aula para revisar el horario, los
          estudiantes y cargar el link de la reunión virtual.
        </p>
      </header>

      {groups.length === 0 ? (
        <EmptyState
          icon={School}
          title="Aún sin aulas asignadas"
          description="Cuando coordinación te asigne a un aula vas a verla acá con su horario y estudiantes."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <li key={g.id}>
              <AulaCard group={g} />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}

function AulaCard({ group }: { group: TeacherClassGroupListItem }) {
  const isVirtual = group.modality === "VIRTUAL" || group.modality === "HIBRIDO"
  const tone = STATUS_TONE[group.status]

  return (
    <Link
      href={`/docente/aulas/${group.id}` as Route}
      className="group border-border bg-surface relative block overflow-hidden rounded-xl border p-5 transition-colors hover:border-teal-500"
    >
      <span
        aria-hidden
        className="bg-border-strong/60 absolute inset-y-0 left-0 w-1 transition-colors group-hover:bg-teal-500"
      />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground text-[15.5px] font-medium">{group.name}</span>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10.5px] tracking-[0.06em] uppercase ${tone.className}`}
            >
              {tone.label}
            </span>
          </div>
          <div className="text-text-3 mt-0.5 text-[12.5px]">{group.programLabel}</div>
        </div>
        <Tag>{MODALITY_LABEL[group.modality] ?? group.modality}</Tag>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 pl-2">
        {group.slots.length === 0 ? (
          <span className="text-text-3 text-[12px]">Sin horarios cargados</span>
        ) : (
          group.slots.map((s, idx) => (
            <span
              key={idx}
              className="border-border bg-bone-50 text-text-2 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11.5px]"
            >
              {DAYS_SHORT_ES[s.dayOfWeek]} {s.startTime}
            </span>
          ))
        )}
      </div>

      <div className="border-border/60 text-text-3 mt-4 flex items-center justify-between gap-3 border-t pt-3 pl-2 text-[12.5px]">
        <span className="inline-flex items-center gap-1.5">
          <Users size={11.5} strokeWidth={1.6} />
          {group.studentCount} {group.studentCount === 1 ? "estudiante" : "estudiantes"}
        </span>
        {isVirtual && (
          <span className="inline-flex items-center gap-1.5">
            <Video size={11.5} strokeWidth={1.6} />
            {group.hasMeetingUrl ? (
              "Link cargado"
            ) : (
              <span className="text-warning">Falta link</span>
            )}
          </span>
        )}
        <span className="text-text-2 inline-flex items-center gap-1 transition-colors group-hover:text-teal-500">
          Abrir
          <ArrowUpRight size={11} strokeWidth={1.6} />
        </span>
      </div>
    </Link>
  )
}
