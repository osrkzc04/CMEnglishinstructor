import type { Route } from "next"
import type { Metadata } from "next"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { listCefrLevelsByLanguage } from "@/modules/teachers/queries"
import { NewTeacherForm } from "./_components/NewTeacherForm"

export const metadata: Metadata = { title: "Nuevo docente" }

export default async function NuevoDocentePage() {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const cefrGroups = await listCefrLevelsByLanguage()

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
        { label: "Docentes", href: "/admin/docentes" as Route },
        { label: "Nuevo" },
      ]}
    >
      <header className="mb-6">
        <h1 className="font-serif text-[32px] font-normal leading-[1.18] tracking-[-0.02em]">
          Nuevo docente
        </h1>
      </header>

      <NewTeacherForm cefrGroups={cefrGroups} />
    </AppShell>
  )
}
