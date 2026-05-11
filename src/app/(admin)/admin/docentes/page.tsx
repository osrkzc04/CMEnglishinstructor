import type { Route } from "next"
import type { Metadata } from "next"
import { UserStatus } from "@prisma/client"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getTeacherStats, listTeachers } from "@/modules/teachers/queries"
import { TeacherListFiltersSchema } from "@/modules/teachers/schemas"
import { DocentesToolbar } from "./_components/DocentesToolbar"
import { DocentesTable } from "./_components/DocentesTable"
import { DocentesPager } from "./_components/DocentesPager"
import { StatsStrip } from "./_components/StatsStrip"

/**
 * Listado de docentes — `/admin/docentes`. Pantalla central para gestión de
 * la planta docente: alta directa, edición de datos / niveles /
 * disponibilidad, y navegación al detalle individual donde se ven
 * asignaciones vigentes y histórico.
 */

export const metadata: Metadata = { title: "Docentes" }

type SearchParams = {
  q?: string
  status?: string
  page?: string
}

export default async function DocentesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const sp = await searchParams

  const safeStatus =
    sp.status && isUserStatus(sp.status) ? sp.status : undefined

  const filters = TeacherListFiltersSchema.parse({
    q: sp.q,
    status: safeStatus,
    page: sp.page,
  })

  const [list, stats] = await Promise.all([
    listTeachers(filters),
    getTeacherStats(),
  ])

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
        { label: "Docentes" },
      ]}
    >
      <header className="mb-6">
        <h1 className="font-serif text-[32px] font-normal leading-[1.18] tracking-[-0.02em]">
          Docentes
        </h1>
      </header>

      <StatsStrip stats={stats} />

      <DocentesToolbar
        initialQuery={filters.q ?? ""}
        initialStatus={filters.status ?? "ALL"}
      />

      <DocentesTable items={list.items} />

      {list.totalPages > 1 && (
        <DocentesPager
          page={list.page}
          totalPages={list.totalPages}
          total={list.total}
          pageSize={list.pageSize}
        />
      )}
    </AppShell>
  )
}

function isUserStatus(value: string): value is UserStatus {
  return value in UserStatus
}
