import type { Route } from "next"
import type { Metadata } from "next"
import { ClassGroupStatus } from "@prisma/client"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { listClassGroups } from "@/modules/classGroups/queries"
import { ClassGroupListFiltersSchema } from "@/modules/classGroups/schemas"
import { AulasToolbar } from "./_components/AulasToolbar"
import { AulasTable } from "./_components/AulasTable"
import { AulasPager } from "./_components/AulasPager"

export const metadata: Metadata = { title: "Aulas" }

type SearchParams = {
  q?: string
  status?: string
  page?: string
}

export default async function AulasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const sp = await searchParams

  const safeStatus = sp.status && isClassGroupStatus(sp.status) ? sp.status : undefined

  const filters = ClassGroupListFiltersSchema.parse({
    q: sp.q,
    status: safeStatus,
    page: sp.page,
  })

  const list = await listClassGroups(filters)

  return (
    <AppShell
      role={user.role!}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role!),
      }}
      breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" as Route }, { label: "Aulas" }]}
    >
      <header className="mb-6">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Operación
        </p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Aulas
        </h1>
        <p className="text-text-3 mt-2 max-w-2xl text-[14px] leading-[1.55]">
          Cada aula agrupa matrículas del mismo nivel con un horario y un docente. Una clase 1-a-1
          es un aula con un solo alumno.
        </p>
      </header>

      <AulasToolbar initialQuery={filters.q ?? ""} initialStatus={filters.status ?? "ALL"} />

      <AulasTable items={list.items} />

      {list.totalPages > 1 && (
        <AulasPager
          page={list.page}
          totalPages={list.totalPages}
          total={list.total}
          pageSize={list.pageSize}
        />
      )}
    </AppShell>
  )
}

function isClassGroupStatus(value: string): value is ClassGroupStatus {
  return value in ClassGroupStatus
}
