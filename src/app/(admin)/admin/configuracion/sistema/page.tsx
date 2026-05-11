import type { Metadata } from "next"
import type { Route } from "next"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getSettings } from "@/modules/settings"
import { SystemSettingsForm } from "./_components/SystemSettingsForm"

export const metadata: Metadata = {
  title: "Parámetros del sistema",
}

/**
 * Panel de "Parámetros del sistema" — settings globales del producto.
 *
 * Lee los valores actuales server-side vía `getSettings` (que cae al
 * default del registry si la fila no existe en `AppSetting`) y los pasa
 * como `initialValues` al form. El form se encarga de validar, mandar la
 * action y rerenderizar (la action revalida el path).
 */
export default async function AdminConfiguracionSistemaPage() {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])

  const settings = await getSettings([
    "classDefaultDurationMinutes",
    "weeklyMinHours",
    "weeklyMaxHours",
    "absenceCountsAsConsumed",
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
        {
          label: "Configuración",
          href: "/admin/configuracion" as Route,
        },
        { label: "Parámetros del sistema" },
      ]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Sistema
        </p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Parámetros del sistema
        </h1>
        <p className="text-text-3 mt-2 text-[14px] leading-[1.55]">
          Valores por defecto que rigen las reglas del producto. Lo que cambies acá impacta a las
          aulas y matrículas que se creen de aquí en adelante. Las aulas existentes mantienen sus
          snapshots — no se edita histórico retroactivamente.
        </p>
      </header>

      <SystemSettingsForm initialValues={settings} />
    </AppShell>
  )
}
