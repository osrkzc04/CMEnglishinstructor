import type { Route } from "next"
import type { Metadata } from "next"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { NewStaffForm } from "./_components/NewStaffForm"

export const metadata: Metadata = { title: "Nuevo usuario" }

export default async function NuevoUsuarioPage() {
  const user = await requireRole(["DIRECTOR"])

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
        { label: "Nuevo" },
      ]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Sistema
        </p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Nuevo usuario
        </h1>
        <p className="text-text-3 mt-2 text-[14px] leading-[1.55]">
          Crea un usuario interno con acceso al panel administrativo. El usuario recibirá un correo
          con un enlace para definir su contraseña antes del primer ingreso.
        </p>
      </header>

      <NewStaffForm />
    </AppShell>
  )
}
