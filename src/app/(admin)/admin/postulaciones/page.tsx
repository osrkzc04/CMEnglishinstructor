import type { Route } from "next"
import type { Metadata } from "next"
import { ApplicationStatus } from "@prisma/client"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  getApplicationById,
  listApplications,
  listEnglishCefrLevels,
} from "@/modules/teachers/applications/queries"
import { ApplicationListFiltersSchema } from "@/modules/teachers/applications/schemas"
import { PostulacionesToolbar } from "./_components/PostulacionesToolbar"
import { PostulacionesTable } from "./_components/PostulacionesTable"
import { PostulacionesPager } from "./_components/PostulacionesPager"
import { ApplicationFormDialog } from "./_components/ApplicationFormDialog"

/**
 * Listado de postulaciones de docentes — `/admin/postulaciones`.
 *
 * Server Component. Lee filtros desde el URL (?q & ?status & ?page) y, si
 * `?action` indica abrir el form (`new` | `edit`), monta `<ApplicationFormDialog>`
 * con los datos correspondientes. Esto hace el dialog deep-linkable y
 * elimina la necesidad de coordinar estado entre toolbar y filas.
 */

export const metadata: Metadata = { title: "Postulaciones de docentes" }

type SearchParams = {
  q?: string
  status?: string
  page?: string
  action?: string
  id?: string
}

export default async function PostulacionesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const sp = await searchParams

  // Validación defensiva: si llega un `status` que no es enum válido, lo
  // descartamos (en vez de tirar 500).
  const safeStatus = sp.status && isApplicationStatus(sp.status) ? sp.status : undefined

  const filters = ApplicationListFiltersSchema.parse({
    q: sp.q,
    status: safeStatus,
    page: sp.page,
  })

  const [list, cefrOptions] = await Promise.all([
    listApplications(filters),
    listEnglishCefrLevels(),
  ])

  const dialogState = await resolveDialogState(sp.action, sp.id)

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
        { label: "Postulaciones" },
      ]}
    >
      <header className="mb-6">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Equipo docente
        </p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Postulaciones
        </h1>
      </header>

      <PostulacionesToolbar
        initialQuery={filters.q ?? ""}
        initialStatus={filters.status ?? "ALL"}
      />

      <PostulacionesTable items={list.items} />

      {list.totalPages > 1 && (
        <PostulacionesPager
          page={list.page}
          totalPages={list.totalPages}
          total={list.total}
          pageSize={list.pageSize}
        />
      )}

      {dialogState && (
        <ApplicationFormDialog
          applicationId={dialogState.applicationId}
          initialValues={dialogState.initialValues}
          cefrOptions={cefrOptions}
        />
      )}
    </AppShell>
  )
}

function isApplicationStatus(value: string): value is ApplicationStatus {
  return value in ApplicationStatus
}

/**
 * Si `?action=edit&id=...` está presente, carga el detalle para precargar
 * el dialog de edición. El listado y el detalle se piden en paralelo
 * desde el caller (`Promise.all` aguas arriba).
 */
async function resolveDialogState(action: string | undefined, id: string | undefined) {
  if (action !== "edit" || !id) return null
  const detail = await getApplicationById(id)
  if (!detail) return null
  return {
    applicationId: detail.id,
    initialValues: {
      firstName: detail.firstName,
      lastName: detail.lastName,
      email: detail.email,
      phone: detail.phone,
      document: detail.document,
      bio: detail.bio ?? undefined,
      levelIds: detail.levelIds,
      availability: detail.availability,
    },
  }
}
