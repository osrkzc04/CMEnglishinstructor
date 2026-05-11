import type { Route } from "next"
import type { Metadata } from "next"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getTeacherAvailabilityBlocks } from "@/modules/teachers/queries"
import { AvailabilityForm } from "@/app/(admin)/admin/docentes/[id]/_components/AvailabilityForm"

export const metadata: Metadata = { title: "Disponibilidad" }

export default async function TeacherDisponibilidadPage() {
  const user = await requireRole(["TEACHER"])

  const blocks = await getTeacherAvailabilityBlocks(user.id)

  return (
    <AppShell
      role={user.role!}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role!),
      }}
      breadcrumbs={[
        { label: "Docente", href: "/docente/dashboard" as Route },
        { label: "Disponibilidad" },
      ]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
          Mi cuenta
        </p>
        <h1 className="font-serif text-[32px] font-normal leading-[1.18] tracking-[-0.02em]">
          Mi disponibilidad
        </h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-text-3">
          Marcá las franjas en las que podés tomar clases. Coordinación cruza
          este horario con el de los estudiantes al armar las aulas. Click y
          arrastrá para pintar bloques de 15 minutos.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-surface px-6 py-5">
        <AvailabilityForm teacherId={user.id} initialBlocks={blocks} />
      </section>
    </AppShell>
  )
}
