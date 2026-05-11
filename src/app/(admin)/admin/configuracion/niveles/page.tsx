import type { Route } from "next"
import type { Metadata } from "next"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  listProgramLevelsForAdmin,
  listProgramOptions,
} from "@/modules/catalog/queries"
import { NivelesWorkspace } from "./_components/NivelesWorkspace"

export const metadata: Metadata = { title: "Niveles" }

export default async function NivelesPage() {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])

  const [levels, programs] = await Promise.all([
    listProgramLevelsForAdmin(),
    listProgramOptions(),
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
        { label: "Configuración", href: "/admin/configuracion" as Route },
        { label: "Niveles" },
      ]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
          Catálogo
        </p>
        <h1 className="font-serif text-[32px] font-normal leading-[1.18] tracking-[-0.02em]">
          Niveles
        </h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-text-3">
          Cada nivel define las horas totales que se contratan al matricular
          un alumno y aparece en los selectores al crear aulas o matrículas.
          Desactivar un nivel lo esconde de los selectores sin perder las
          matrículas existentes.
        </p>
      </header>

      <NivelesWorkspace levels={levels} programs={programs} />
    </AppShell>
  )
}
