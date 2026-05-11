import type { Route } from "next"
import type { Metadata } from "next"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getStudentPreferredSchedule } from "@/modules/students/queries"
import { PreferredScheduleForm } from "@/app/(admin)/admin/estudiantes/[id]/_components/PreferredScheduleForm"

export const metadata: Metadata = { title: "Mi horario" }

export default async function StudentHorarioPage() {
  const user = await requireRole(["STUDENT"])

  const blocks = await getStudentPreferredSchedule(user.id)

  return (
    <AppShell
      role={user.role!}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role!),
      }}
      breadcrumbs={[
        { label: "Estudiante", href: "/estudiante/dashboard" as Route },
        { label: "Mi horario" },
      ]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">Cuenta</p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Mi horario semanal
        </h1>
        <p className="text-text-3 mt-2 text-[14px] leading-[1.55]">
          Marcá las franjas en las que podés tomar clase. Coordinación las usa para ubicarte en un
          aula que cuadre con tu nivel y con un docente disponible. Click y arrastrá sobre la grilla
          para pintar bloques de 15 minutos.
        </p>
      </header>

      <section className="border-border bg-surface rounded-xl border px-6 py-5">
        <PreferredScheduleForm studentId={user.id} initialBlocks={blocks} />
      </section>
    </AppShell>
  )
}
