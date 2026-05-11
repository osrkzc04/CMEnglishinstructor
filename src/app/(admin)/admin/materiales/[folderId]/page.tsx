import { notFound } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import type { Metadata } from "next"
import { ChevronRight, Home } from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getFolderDetail } from "@/modules/materials/queries"
import { FolderBrowser } from "../_components/FolderBrowser"

export const metadata: Metadata = { title: "Materiales" }

type RouteParams = { folderId: string }

export default async function MaterialesFolderPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const { folderId } = await params

  const detail = await getFolderDetail(folderId)
  if (!detail) notFound()

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
        { label: "Materiales", href: "/admin/materiales" as Route },
        { label: detail.isRoot ? detail.levelName : detail.name },
      ]}
    >
      <header className="mb-6">
        <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
          {detail.programName} · {detail.levelName}
        </p>
        <h1 className="font-serif text-[28px] font-normal leading-[1.2] tracking-[-0.02em]">
          {detail.name}
        </h1>
        <FolderTrail
          breadcrumb={detail.breadcrumb}
          levelName={detail.levelName}
        />
      </header>

      <FolderBrowser folder={detail} />
    </AppShell>
  )
}

function FolderTrail({
  breadcrumb,
  levelName,
}: {
  breadcrumb: { id: string; name: string }[]
  levelName: string
}) {
  if (breadcrumb.length <= 1) return null

  return (
    <nav
      aria-label="Ruta de la carpeta"
      className="mt-3 flex flex-wrap items-center gap-1 text-[12.5px] text-text-3"
    >
      <Link
        href={"/admin/materiales" as Route}
        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <Home size={11} strokeWidth={1.6} />
        Materiales
      </Link>
      {breadcrumb.map((node, idx) => {
        const isLast = idx === breadcrumb.length - 1
        const label = idx === 0 ? levelName : node.name
        return (
          <span key={node.id} className="inline-flex items-center gap-1">
            <ChevronRight size={11} strokeWidth={1.6} className="text-text-3/60" />
            {isLast ? (
              <span className="text-text-2">{label}</span>
            ) : (
              <Link
                href={`/admin/materiales/${node.id}` as Route}
                className="transition-colors hover:text-foreground"
              >
                {label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
