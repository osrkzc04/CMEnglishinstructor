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
        <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
          Operación
        </p>
        <h1 className="font-serif text-[32px] font-normal leading-[1.18] tracking-[-0.02em]">
          Nuevo estudiante
        </h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-text-3">
          Crea el alumno con su matrícula y horario preferido. La
          asignación a un aula concreta se hace después desde el menú de
          Aulas.
        </p>
      </header>

      <NewStudentForm programLevels={programLevels} />
    </AppShell>
  )
}
