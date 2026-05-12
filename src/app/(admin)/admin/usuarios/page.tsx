import type { Route } from "next"
import type { Metadata } from "next"
import { Role, UserStatus } from "@prisma/client"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getStaffStats, listStaff } from "@/modules/users/queries"
import { StaffListFiltersSchema } from "@/modules/users/schemas"
import { UsuariosToolbar } from "./_components/UsuariosToolbar"
import { UsuariosTable } from "./_components/UsuariosTable"
import { UsuariosPager } from "./_components/UsuariosPager"
import { StatsStrip } from "./_components/StatsStrip"

/**
 * Listado de usuarios staff (dirección y coordinación) — `/admin/usuarios`.
 *
 * Es el panel desde el que la dirección administra a quienes pueden entrar
 * al backoffice. Estudiantes y docentes viven en sus propias pantallas
 * porque tienen ciclo de vida (matrículas, asignaciones) que acá no aplica.
 */

export const metadata: Metadata = { title: "Usuarios" }

type SearchParams = {
  q?: string
  status?: string
  role?: string
  page?: string
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await requireRole(["DIRECTOR"])
  const sp = await searchParams

  const safeStatus = sp.status && isUserStatus(sp.status) ? sp.status : undefined
  const safeRole = sp.role && isStaffRole(sp.role) ? sp.role : undefined

  const filters = StaffListFiltersSchema.parse({
    q: sp.q,
    status: safeStatus,
    role: safeRole,
    page: sp.page,
  })

  const [list, stats] = await Promise.all([listStaff(filters), getStaffStats()])

  return (
    <AppShell
      role={user.role!}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role!),
      }}
      breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" as Route }, { label: "Usuarios" }]}
    >
      <header className="mb-6">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Sistema
        </p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Usuarios
        </h1>
        <p className="text-text-3 mt-2 max-w-2xl text-[14px] leading-[1.55]">
          Gestiona a quienes tienen acceso al panel administrativo: dirección y coordinación. El
          alta de estudiantes y docentes se hace desde sus pantallas dedicadas.
        </p>
      </header>

      <StatsStrip stats={stats} />

      <UsuariosToolbar
        initialQuery={filters.q ?? ""}
        initialStatus={filters.status ?? "ALL"}
        initialRole={filters.role ?? "ALL"}
        currentUserId={user.id}
      />

      <UsuariosTable items={list.items} currentUserId={user.id} />

      {list.totalPages > 1 && (
        <UsuariosPager
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

function isStaffRole(value: string): value is "DIRECTOR" | "COORDINATOR" {
  return value === Role.DIRECTOR || value === Role.COORDINATOR
}
