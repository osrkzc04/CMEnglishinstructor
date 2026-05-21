import type { Route } from "next"
import type { Metadata } from "next"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getInviteStats, listTestInvites, type InviteState } from "@/modules/tests/invites/queries"
import { buildTestInviteLink } from "@/modules/tests/invites/emails"
import { TestInviteListFiltersSchema } from "@/modules/tests/invites/schemas"
import { prisma } from "@/lib/prisma"
import { PruebasToolbar } from "./_components/PruebasToolbar"
import { PruebasTable } from "./_components/PruebasTable"
import { PruebasPager } from "./_components/PruebasPager"
import { StatsStrip } from "./_components/StatsStrip"

/**
 * `/admin/pruebas` — listado de invitaciones a evaluaciones de ubicación.
 *
 * Lo gestionan dirección y coordinación. Para cada candidato muestra estado
 * (por entregar / en curso / por revisar / revisada / vencida), permite
 * copiar el link y reenviar el correo. La revisión vive en `/admin/pruebas/[id]`
 * (Fase 4).
 */

export const metadata: Metadata = { title: "Pruebas" }

type SearchParams = {
  q?: string
  state?: string
  page?: string
}

const VALID_STATES = new Set<InviteState>([
  "PENDING",
  "IN_PROGRESS",
  "SUBMITTED",
  "TIMED_OUT",
  "REVIEWED",
  "EXPIRED",
])

export default async function PruebasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const sp = await searchParams

  const safeState =
    sp.state && VALID_STATES.has(sp.state as InviteState) ? (sp.state as InviteState) : undefined

  const filters = TestInviteListFiltersSchema.parse({
    q: sp.q,
    state: safeState,
    page: sp.page,
  })

  const [list, stats, hasTemplate] = await Promise.all([
    listTestInvites(filters),
    getInviteStats(),
    prisma.testTemplate.count({ where: { purpose: "PLACEMENT", isActive: true } }),
  ])

  const itemsWithLink = list.items.map((item) => ({
    ...item,
    link: buildTestInviteLink(item.token),
  }))

  return (
    <AppShell
      role={user.role!}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role!),
      }}
      breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" as Route }, { label: "Pruebas" }]}
    >
      <header className="mb-6">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Operación
        </p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Pruebas
        </h1>
        <p className="text-text-3 mt-2 max-w-2xl text-[14px] leading-[1.55]">
          Crea invitaciones a la evaluación de ubicación, copia el enlace si necesitas pasarlo por
          otra vía y revisa el estado de cada candidato. La revisión final se hace al abrir cada
          evaluación.
        </p>
      </header>

      {hasTemplate === 0 ? (
        <div className="border-warning/40 bg-warning/[0.06] mb-6 rounded-xl border px-5 py-4">
          <p className="text-foreground text-[14px] font-medium">
            No hay plantilla de evaluación activa
          </p>
          <p className="text-text-3 mt-1 text-[13px] leading-[1.55]">
            Pídele a quien administre el banco de preguntas que active la plantilla de placement
            antes de poder invitar candidatos.
          </p>
        </div>
      ) : (
        <StatsStrip stats={stats} />
      )}

      <PruebasToolbar initialQuery={filters.q ?? ""} initialState={filters.state ?? "ALL"} />

      <PruebasTable items={itemsWithLink} />

      {list.totalPages > 1 && (
        <PruebasPager
          page={list.page}
          totalPages={list.totalPages}
          total={list.total}
          pageSize={list.pageSize}
        />
      )}
    </AppShell>
  )
}
