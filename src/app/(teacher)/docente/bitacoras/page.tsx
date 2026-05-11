import type { Route } from "next"
import type { Metadata } from "next"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FolderOpen,
  NotebookPen,
  PencilLine,
} from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  listTeacherBitacoras,
  type TeacherBitacoraEntry,
  type TeacherBitacoraPending,
} from "@/modules/teachers/queries"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Bitácoras" }

const STATUS_LABEL: Record<TeacherBitacoraEntry["status"], string> = {
  SCHEDULED: "En curso",
  COMPLETED: "Cerrada",
  CANCELLED: "Cancelada",
  NO_SHOW: "Sin registro",
}

const STATUS_TONE: Record<TeacherBitacoraEntry["status"], string> = {
  SCHEDULED: "border-warning/35 bg-warning/[0.07] text-warning",
  COMPLETED: "border-teal-500/35 bg-teal-500/[0.07] text-teal-700",
  CANCELLED: "border-danger/35 bg-danger/[0.07] text-danger",
  NO_SHOW: "border-warning/35 bg-warning/[0.07] text-warning",
}

export default async function TeacherBitacorasPage({
  searchParams,
}: {
  searchParams: Promise<{ aula?: string }>
}) {
  const user = await requireRole(["TEACHER"])
  const params = await searchParams
  const aulaFilter = params.aula?.trim() ? params.aula.trim() : undefined

  const { pendings, entries, classGroups, entriesTotal } = await listTeacherBitacoras(user.id, {
    classGroupId: aulaFilter,
  })

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
        { label: "Bitácoras" },
      ]}
    >
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
            Mi día
          </p>
          <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
            Bitácoras
          </h1>
          <p className="text-text-3 mt-2 max-w-[620px] text-[14px] leading-[1.55]">
            Lo que dictaste en cada clase: tema, actividades, tarea y materiales. Las cargas
            mientras la clase está en curso y al cerrar quedan congeladas como histórico.
          </p>
        </div>
        <div className="text-text-3 flex flex-wrap items-center gap-3 font-mono text-[12.5px] tracking-[0.04em]">
          <span>{entriesTotal} cargadas</span>
          <span aria-hidden>·</span>
          <span className={pendings.length > 0 ? "text-warning" : undefined}>
            {pendings.length} {pendings.length === 1 ? "pendiente" : "pendientes"}
          </span>
        </div>
      </header>

      {classGroups.length > 1 && (
        <AulaFilter classGroups={classGroups} activeId={aulaFilter ?? null} />
      )}

      {pendings.length > 0 && (
        <section className="mb-9">
          <SectionHeader
            icon={AlertTriangle}
            tone="warn"
            title="Pendientes"
            description={`${pendings.length} ${pendings.length === 1 ? "clase necesita" : "clases necesitan"} su bitácora.`}
          />
          <ul className="space-y-2.5">
            {pendings.map((p) => (
              <li key={p.sessionId}>
                <PendingRow item={p} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionHeader
          icon={NotebookPen}
          title="Historial"
          description={
            entries.length === 0
              ? "Cuando cargues tu primera bitácora aparecerá acá."
              : entries.length === entriesTotal
                ? `${entries.length} ${entries.length === 1 ? "registro" : "registros"}.`
                : `Mostrando los últimos ${entries.length} de ${entriesTotal}.`
          }
        />
        {entries.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="Sin bitácoras"
            description="Cargá la bitácora desde el detalle de cada sesión. Lo que escribas queda acá como histórico de tus clases."
          />
        ) : (
          <ul className="space-y-2.5">
            {entries.map((e) => (
              <li key={e.sessionId}>
                <BitacoraCard entry={e} />
              </li>
            ))}
          </ul>
        )}
      </section>
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
      <span className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
        Filtrar por aula
      </span>
      <Link
        href={"/docente/bitacoras" as Route}
        className={cn(
          "rounded-full border px-3 py-1 font-mono text-[11.5px] tracking-[0.02em] transition-colors",
          activeId === null
            ? "border-teal-500/40 bg-teal-500/[0.07] text-teal-700"
            : "border-border bg-surface text-text-2 hover:border-teal-500 hover:text-teal-500",
        )}
      >
        Todas
      </Link>
      {classGroups.map((g) => (
        <Link
          key={g.id}
          href={`/docente/bitacoras?aula=${g.id}` as Route}
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

function SectionHeader({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: typeof NotebookPen
  tone?: "warn"
  title: string
  description?: string
}) {
  return (
    <header className="mb-3 flex flex-wrap items-baseline gap-2">
      <Icon
        size={14}
        strokeWidth={1.6}
        className={tone === "warn" ? "text-warning" : "text-text-3"}
      />
      <h2 className="text-foreground font-serif text-[20px] font-normal">{title}</h2>
      {description && <span className="text-text-3 text-[12.5px]">{description}</span>}
    </header>
  )
}

function PendingRow({ item }: { item: TeacherBitacoraPending }) {
  return (
    <Link
      href={`/docente/clases/${item.sessionId}` as Route}
      className="group border-warning/40 bg-surface hover:border-warning relative flex flex-wrap items-center gap-4 overflow-hidden rounded-xl border px-4 py-3.5 pl-5 transition-colors"
    >
      <span aria-hidden className="bg-warning/70 absolute inset-y-0 left-0 w-1" />
      <div className="text-text-3 min-w-[140px] text-[12.5px]">
        {formatDate(item.scheduledStart)}
        <div className="text-text-2 mt-0.5 font-mono text-[13px] tracking-[0.02em]">
          {formatTime(item.scheduledStart)} – {formatTime(item.scheduledEnd)}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-foreground text-[14.5px] font-medium">{item.classGroupName}</div>
        <div className="text-text-3 mt-0.5 text-[12.5px]">{item.programLabel}</div>
      </div>
      <div className="border-warning/40 bg-warning/[0.07] text-warning inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px]">
        <PencilLine size={12} strokeWidth={1.6} />
        Cargar bitácora
      </div>
      <ArrowUpRight
        size={13}
        strokeWidth={1.6}
        className="text-text-3 group-hover:text-warning transition-colors"
      />
    </Link>
  )
}

function BitacoraCard({ entry }: { entry: TeacherBitacoraEntry }) {
  const isCompleted = entry.status === "COMPLETED"
  return (
    <details className="group border-border bg-surface hover:border-border-strong relative overflow-hidden rounded-xl border transition-colors open:border-teal-500/40">
      <span
        aria-hidden
        className="bg-border-strong/60 absolute inset-y-0 left-0 w-1 transition-colors group-open:bg-gradient-to-b group-open:from-teal-500 group-open:to-teal-700"
      />
      <summary className="flex cursor-pointer flex-wrap items-center gap-4 px-4 py-3.5 pl-5 outline-none">
        <div className="text-text-3 min-w-[140px] text-[12.5px]">
          {formatDate(entry.scheduledStart)}
          <div className="text-text-2 mt-0.5 font-mono text-[13px] tracking-[0.02em]">
            {formatTime(entry.scheduledStart)} – {formatTime(entry.scheduledEnd)}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-foreground text-[14.5px] font-medium">{entry.classGroupName}</div>
          <div className="text-text-3 mt-0.5 text-[12.5px]">{entry.programLabel}</div>
          <div className="text-text-2 mt-1 truncate text-[13px] italic">{entry.topic}</div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] tracking-[0.06em] uppercase",
            STATUS_TONE[entry.status],
          )}
        >
          {isCompleted ? (
            <CheckCircle2 size={11} strokeWidth={1.6} />
          ) : (
            <PencilLine size={11} strokeWidth={1.6} />
          )}
          {STATUS_LABEL[entry.status]}
        </span>
      </summary>

      <div className="border-border/60 bg-bone-50/30 border-t px-5 py-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Block icon={BookOpen} label="Tema">
            <p className="text-foreground text-[13.5px] leading-[1.55] whitespace-pre-line">
              {entry.topic}
            </p>
          </Block>
          <Block icon={ClipboardList} label="Actividades">
            <p className="text-foreground text-[13.5px] leading-[1.55] whitespace-pre-line">
              {entry.activities}
            </p>
          </Block>
          {entry.homework && (
            <Block icon={NotebookPen} label="Tarea">
              <p className="text-foreground text-[13.5px] leading-[1.55] whitespace-pre-line">
                {entry.homework}
              </p>
            </Block>
          )}
          {entry.materialsUsed && (
            <Block icon={FolderOpen} label="Materiales usados">
              <p className="text-foreground text-[13.5px] leading-[1.55] whitespace-pre-line">
                {entry.materialsUsed}
              </p>
            </Block>
          )}
        </div>
        <div className="border-border/60 text-text-3 mt-4 flex items-center justify-between border-t pt-3 text-[12px]">
          <span className="font-mono">Actualizada {formatRelative(entry.updatedAt)}</span>
          <Link
            href={`/docente/clases/${entry.sessionId}` as Route}
            className="inline-flex items-center gap-1 text-teal-500 hover:underline"
          >
            Abrir sesión
            <ArrowUpRight size={11} strokeWidth={1.6} />
          </Link>
        </div>
      </div>
    </details>
  )
}

function Block({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof BookOpen
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="text-text-3 mb-1.5 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] uppercase">
        <Icon size={11} strokeWidth={1.6} />
        {label}
      </div>
      {children}
    </div>
  )
}

// -----------------------------------------------------------------------------
//  Helpers de fecha (Guayaquil)
// -----------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "America/Guayaquil",
})

const timeFormatter = new Intl.DateTimeFormat("es-EC", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Guayaquil",
})

const fullFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Guayaquil",
})

function formatDate(d: Date): string {
  return dateFormatter.format(d).replace(/\./g, "")
}

function formatTime(d: Date): string {
  return timeFormatter.format(d)
}

function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime()
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return "ahora"
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 7) return `hace ${days} ${days === 1 ? "día" : "días"}`
  return fullFormatter.format(d).replace(/\./g, "")
}
