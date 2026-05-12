import { notFound } from "next/navigation"
import type { Route } from "next"
import type { Metadata } from "next"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getStaffDetail } from "@/modules/users/queries"
import { ResendAccessLinkButton } from "@/components/auth/ResendAccessLinkButton"
import { StatusBadge } from "@/app/(admin)/admin/estudiantes/_components/StatusBadge"
import { StaffPersonalDataForm } from "./_components/StaffPersonalDataForm"

export const metadata: Metadata = { title: "Usuario" }

type RouteParams = { id: string }

export default async function UsuarioDetallePage({ params }: { params: Promise<RouteParams> }) {
  const user = await requireRole(["DIRECTOR"])
  const { id } = await params

  const detail = await getStaffDetail(id)
  if (!detail) notFound()

  const isSelf = detail.id === user.id

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
        { label: "Usuarios", href: "/admin/usuarios" as Route },
        { label: `${detail.firstName} ${detail.lastName}` },
      ]}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
            Usuario
          </p>
          <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
            {detail.firstName} {detail.lastName}
            {isSelf && (
              <span className="text-text-3 ml-3 align-middle font-sans text-[12px] tracking-[0.08em] uppercase">
                · tu cuenta
              </span>
            )}
          </h1>
          <div className="text-text-3 mt-2 flex flex-wrap items-center gap-3 text-[13px]">
            <span>{detail.email}</span>
            <span aria-hidden>·</span>
            <span>{roleLabel(detail.role)}</span>
            {detail.hasPassword ? (
              <>
                <span aria-hidden>·</span>
                <span>Contraseña creada</span>
              </>
            ) : (
              <>
                <span aria-hidden>·</span>
                <span className="text-warning">Pendiente de activar</span>
              </>
            )}
          </div>
        </div>
        <StatusBadge status={detail.status} />
      </header>

      <section className="border-border bg-surface mb-6 rounded-xl border px-6 py-5">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-text-3 mb-1 font-mono text-[11px] tracking-[0.08em] uppercase">
              Ficha
            </p>
            <h2 className="text-foreground font-serif text-[22px] font-normal tracking-[-0.01em]">
              Datos del usuario
            </h2>
          </div>
          {detail.status === "ACTIVE" && <ResendAccessLinkButton userId={detail.id} />}
        </header>

        <StaffPersonalDataForm
          userId={detail.id}
          isSelf={isSelf}
          initialValues={{
            firstName: detail.firstName,
            lastName: detail.lastName,
            email: detail.email,
            phone: detail.phone ?? undefined,
            document: detail.document ?? undefined,
            role: detail.role === "DIRECTOR" ? "DIRECTOR" : "COORDINATOR",
            status: detail.status,
          }}
        />
      </section>

      {isSelf && (
        <p className="border-border bg-surface-alt text-text-3 rounded-md border px-4 py-3 text-[12.5px] leading-[1.55]">
          Por seguridad no puedes cambiar tu propio rol ni desactivar tu cuenta. Si necesitas
          hacerlo, pídeselo a otro director.
        </p>
      )}
    </AppShell>
  )
}
