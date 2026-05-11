import type { Route } from "next"
import type { Metadata } from "next"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { listProgramLevelOptions } from "@/modules/enrollments/queries"
import { NewStudentForm } from "./_components/NewStudentForm"

export const metadata: Metadata = { title: "Nuevo estudiante" }

export default async function NuevoEstudiantePage() {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])

  const programLevels = await listProgramLevelOptions()

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
        { label: "Estudiantes", href: "/admin/estudiantes" as Route },
        { label: "Nuevo" },
      ]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Operación
        </p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Nuevo estudiante
        </h1>
        <p className="text-text-3 mt-2 text-[14px] leading-[1.55]">
          Crea el alumno con su matrícula y horario preferido. La asignación a un aula concreta se
          hace después desde el menú de Aulas.
        </p>
      </header>

      <NewStudentForm programLevels={programLevels} />
    </AppShell>
  )
}
