import type { Route } from "next"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, BookOpen, FileText, FolderOpen } from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { listProgramLevelRoots } from "@/modules/materials/queries"
import { listAccessibleProgramLevels } from "@/modules/materials/access"
import { Tag } from "@/components/ui/tag"
import { EmptyState } from "@/components/ui/empty-state"

export const metadata: Metadata = { title: "Materiales" }

export default async function TeacherMaterialesIndexPage() {
  const user = await requireRole(["TEACHER"])

  // Solo niveles donde el docente tiene un aula activa asignada — alineado
  // con el dashboard. Si pierde la asignación, pierde el acceso.
  const levelIds = await listAccessibleProgramLevels(user.id, user.role!)
  const roots =
    levelIds.length > 0 ? await listProgramLevelRoots({ programLevelIds: levelIds }) : []

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
        { label: "Materiales" },
      ]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Recursos
        </p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Materiales
        </h1>
        <p className="text-text-3 mt-2 text-[14px] leading-[1.55]">
          Vas a ver acá los materiales de los niveles que estás dictando hoy. Cuando se cierra un
          aula, el acceso pasa al siguiente docente.
        </p>
      </header>

      {roots.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Sin materiales por ahora"
          description="Te aparecerán los repositorios cuando tengas aulas activas asignadas."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roots.map((root) => (
            <li key={root.programLevelId}>
              <Link
                href={`/docente/materiales/${root.rootFolderId}` as Route}
                className="group border-border bg-surface block rounded-xl border p-4 transition-colors hover:border-teal-500"
              >
                <div className="text-text-3 mb-2 inline-flex items-center gap-1.5 font-mono text-[12px] tracking-[0.08em] uppercase">
                  <BookOpen size={11} strokeWidth={1.6} />
                  {root.programName}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-foreground font-medium">{root.levelName}</div>
                    <div className="mt-1">
                      <Tag>Código {root.levelCode}</Tag>
                    </div>
                    <div className="text-text-3 mt-3 flex items-center gap-3 text-[12.5px]">
                      <span className="inline-flex items-center gap-1">
                        <FolderOpen size={12} strokeWidth={1.6} />
                        {root.folderCount} {root.folderCount === 1 ? "carpeta" : "carpetas"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FileText size={12} strokeWidth={1.6} />
                        {root.fileCount} {root.fileCount === 1 ? "archivo" : "archivos"}
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight
                    size={14}
                    strokeWidth={1.6}
                    className="text-text-3 shrink-0 transition-colors group-hover:text-teal-500"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
