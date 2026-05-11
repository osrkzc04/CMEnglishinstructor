import type { Route } from "next"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, BookOpen, FolderOpen, FileText } from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { listProgramLevelRoots } from "@/modules/materials/queries"
import { Tag } from "@/components/ui/tag"
import { EmptyState } from "@/components/ui/empty-state"

export const metadata: Metadata = { title: "Materiales" }

export default async function MaterialesIndexPage() {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])

  const roots = await listProgramLevelRoots()

  // Agrupar por programa para que la página respire — un nivel suelto se
  // pierde al lado de los demás del mismo programa.
  const grouped = groupByProgram(roots)

  return (
    <AppShell
      role={user.role!}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role!),
      }}
      breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" as Route }, { label: "Materiales" }]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Recursos
        </p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Materiales
        </h1>
        <p className="text-text-3 mt-2 text-[14px] leading-[1.55]">
          Cada nivel tiene su propio repositorio. Subí archivos, organizá en subcarpetas y los
          docentes y estudiantes verán solo lo que les corresponde por su nivel.
        </p>
      </header>

      {roots.length === 0 ? (
        <div className="border-border bg-surface rounded-xl border">
          <EmptyState
            title="Sin niveles"
            description="Aún no hay niveles configurados en el catálogo. Crealos primero desde Configuración."
          />
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ programName, items }) => (
            <section key={programName}>
              <div className="mb-3 flex items-baseline gap-2">
                <BookOpen size={14} strokeWidth={1.6} className="text-text-3" />
                <h2 className="text-foreground font-serif text-[18px] font-normal">
                  {programName}
                </h2>
              </div>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((root) => (
                  <li key={root.programLevelId}>
                    <Link
                      href={`/admin/materiales/${root.rootFolderId}` as Route}
                      className="group border-border bg-surface block rounded-xl border p-4 transition-colors hover:border-teal-500"
                    >
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
            </section>
          ))}
        </div>
      )}
    </AppShell>
  )
}

function groupByProgram(roots: Awaited<ReturnType<typeof listProgramLevelRoots>>) {
  const map = new Map<string, typeof roots>()
  for (const root of roots) {
    const existing = map.get(root.programName) ?? []
    existing.push(root)
    map.set(root.programName, existing)
  }
  return Array.from(map.entries()).map(([programName, items]) => ({
    programName,
    items,
  }))
}
