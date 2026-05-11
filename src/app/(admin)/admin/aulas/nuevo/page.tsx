import type { Route } from "next"
import type { Metadata } from "next"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { listProgramLevelOptions } from "@/modules/enrollments/queries"
import { getSettings } from "@/modules/settings"
import { NewClassGroupForm } from "./_components/NewClassGroupForm"

export const metadata: Metadata = { title: "Nueva aula" }

export default async function NuevaAulaPage() {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const [programLevels, weeklyBounds] = await Promise.all([
    listProgramLevelOptions(),
    getSettings(["weeklyMinHours", "weeklyMaxHours"]),
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
        { label: "Aulas", href: "/admin/aulas" as Route },
        { label: "Nueva" },
      ]}
    >
      <header className="mb-7 max-w-3xl">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Operación
        </p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Nueva aula
        </h1>
        <p className="text-text-3 mt-2 text-[14px] leading-[1.55]">
          Elegí el nivel, los candidatos y los horarios. El matchmaker te muestra dónde cuadra la
          disponibilidad de docente y estudiantes para que cierres el aula en una sola pasada.
        </p>
      </header>

      <NewClassGroupForm
        programLevels={programLevels}
        weeklyMinHours={weeklyBounds.weeklyMinHours}
        weeklyMaxHours={weeklyBounds.weeklyMaxHours}
      />
    </AppShell>
  )
}
