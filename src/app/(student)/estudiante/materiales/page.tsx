import type { Route } from "next"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, BookOpen, FileText, FolderOpen, GraduationCap } from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { listProgramLevelRoots } from "@/modules/materials/queries"
import { listAccessibleProgramLevels } from "@/modules/materials/access"
import { Tag } from "@/components/ui/tag"
import { EmptyState } from "@/components/ui/empty-state"

export const metadata: Metadata = { title: "Materiales" }

export default async function StudentMaterialesIndexPage() {
  const user = await requireRole(["STUDENT"])

  // Niveles derivados de matrículas ACTIVE — si el alumno tiene dos cursos
  // a la vez (ej. inglés + español) ve ambos repositorios.
  const levelIds = await listAccessibleProgramLevels(user.id, user.role!)
  const roots =
    levelIds.length > 0
      ? await listProgramLevelRoots({ programLevelIds: levelIds })
      : []

  return (
    <AppShell
      role={user.role!}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role!),
      }}
      breadcrumbs={[
        { label: "Estudiante", href: "/estudiante/dashboard" as Route },
        { label: "Materiales" },
      ]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
          Mi espacio
        </p>
        <h1 className="font-serif text-[32px] font-normal leading-[1.18] tracking-[-0.02em]">
          Materiales
        </h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-text-3">
          Acá vas a encontrar los recursos del nivel que estás cursando: audios,
          PDFs y archivos del programa.
        </p>
      </header>

      {roots.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Aún sin materiales disponibles"
          description="Cuando se publique tu matrícula y haya recursos cargados, los vas a ver acá."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roots.map((root) => (
            <li key={root.programLevelId}>
              <Link
                href={`/estudiante/materiales/${root.rootFolderId}` as Route}
                className="group block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-teal-500"
              >
                <div className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-[0.08em] text-text-3">
                  <BookOpen size={11} strokeWidth={1.6} />
                  {root.programName}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">
                      {root.levelName}
                    </div>
                    <div className="mt-1">
                      <Tag>Código {root.levelCode}</Tag>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-[12.5px] text-text-3">
                      <span className="inline-flex items-center gap-1">
                        <FolderOpen size={12} strokeWidth={1.6} />
                        {root.folderCount}{" "}
                        {root.folderCount === 1 ? "carpeta" : "carpetas"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FileText size={12} strokeWidth={1.6} />
                        {root.fileCount}{" "}
                        {root.fileCount === 1 ? "archivo" : "archivos"}
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight
                    size={14}
                    strokeWidth={1.6}
                    className="shrink-0 text-text-3 transition-colors group-hover:text-teal-500"
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
