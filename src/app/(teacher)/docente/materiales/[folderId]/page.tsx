import { notFound } from "next/navigation"
import type { Route } from "next"
import type { Metadata } from "next"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getFolderDetail } from "@/modules/materials/queries"
import { canAccessProgramLevel } from "@/modules/materials/access"
import { FolderViewer } from "@/components/materials/FolderViewer"

export const metadata: Metadata = { title: "Materiales" }

type RouteParams = { folderId: string }

export default async function TeacherMaterialesFolderPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const user = await requireRole(["TEACHER"])
  const { folderId } = await params

  const detail = await getFolderDetail(folderId)
  if (!detail) notFound()

  const allowed = await canAccessProgramLevel(
    user.id,
    user.role!,
    detail.programLevelId,
  )
  // Tratamos "sin acceso" como 404 — evita leak de existencia. El docente
  // solo puede llegar acá clickeando un link válido del dashboard o de
  // /docente/materiales, no escribiendo IDs a mano.
  if (!allowed) notFound()

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
        { label: "Materiales", href: "/docente/materiales" as Route },
        { label: detail.isRoot ? detail.levelName : detail.name },
      ]}
    >
      <header className="mb-6">
        <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
          {detail.programName} · {detail.levelName}
        </p>
        <h1 className="font-serif text-[28px] font-normal leading-[1.2] tracking-[-0.02em]">
          {detail.isRoot ? detail.levelName : detail.name}
        </h1>
      </header>

      <FolderViewer
        folder={detail}
        basePath="/docente/materiales"
        rootLabel="Materiales"
      />
    </AppShell>
  )
}
