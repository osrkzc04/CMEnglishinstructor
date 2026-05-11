import type { Route } from "next"
import type { Metadata } from "next"
import { UserStatus } from "@prisma/client"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getStudentStats, listStudents } from "@/modules/students/queries"
import { StudentListFiltersSchema } from "@/modules/students/schemas"
import { EstudiantesToolbar } from "./_components/EstudiantesToolbar"
import { EstudiantesTable } from "./_components/EstudiantesTable"
import { EstudiantesPager } from "./_components/EstudiantesPager"
import { StatsStrip } from "./_components/StatsStrip"

/**
 * Listado de estudiantes — `/admin/estudiantes`. Es la pantalla central de
 * gestión: alta de estudiante (con su matrícula), edición de datos y
 * navegación al detalle individual donde se rota docente o se ve histórico.
 */

export const metadata: Metadata = { title: "Estudiantes" }

type SearchParams = {
  q?: string
  status?: string
  page?: string
}

export default async function EstudiantesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const sp = await searchParams

  const safeStatus =
    sp.status && isUserStatus(sp.status) ? sp.status : undefined

  const filters = StudentListFiltersSchema.parse({
    q: sp.q,
    status: safeStatus,
    page: sp.page,
  })

  const [list, stats] = await Promise.all([
    listStudents(filters),
    getStudentStats(),
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
        { label: "Estudiantes" },
      ]}
    >
      <header className="mb-6">
        <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
          Operación
        </p>
        <h1 className="font-serif text-[32px] font-normal leading-[1.18] tracking-[-0.02em]">
          Estudiantes
        </h1>
      </header>

      <StatsStrip stats={stats} />

      <EstudiantesToolbar
        initialQuery={filters.q ?? ""}
        initialStatus={filters.status ?? "ALL"}
      />

      <EstudiantesTable items={list.items} />

      {list.totalPages > 1 && (
        <EstudiantesPager
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
