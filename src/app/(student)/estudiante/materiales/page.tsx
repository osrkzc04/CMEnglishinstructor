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
        { label: "Estudiante", href: "/estudiante/dashboard" as Route },
        { label: "Materiales" },
      ]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Mi espacio
        </p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Materiales
        </h1>
        <p className="text-text-3 mt-2 text-[14px] leading-[1.55]">
          Acá vas a encontrar los recursos del nivel que estás cursando: audios, PDFs y archivos del
          programa.
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
