import type { Route } from "next"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { prisma } from "@/lib/prisma"
import { NewTestInviteForm } from "./_components/NewTestInviteForm"

/**
 * `/admin/pruebas/nueva` — alta de candidato para placement test.
 *
 * El form crea un `InviteToken` y dispara el correo. Si la academia tiene
 * más de una plantilla activa, el form muestra un selector; si hay una
 * sola la deja preseleccionada y oculta el control.
 */

export const metadata: Metadata = { title: "Nueva evaluación" }

export default async function NuevaPruebaPage() {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])

  const templates = await prisma.testTemplate.findMany({
    where: { purpose: "PLACEMENT", isActive: true },
    select: { id: true, name: true, timeLimitMinutes: true },
    orderBy: { createdAt: "asc" },
  })

  if (templates.length === 0) {
    notFound()
  }

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
        { label: "Pruebas", href: "/admin/pruebas" as Route },
        { label: "Nueva" },
      ]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Operación
        </p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Nueva evaluación
        </h1>
        <p className="text-text-3 mt-2 text-[14px] leading-[1.55]">
          Registra al candidato y enviamos por correo el enlace para que rinda la evaluación de
          ubicación. También puedes copiar el enlace para pasarlo por otro canal.
        </p>
      </header>

      <NewTestInviteForm templates={templates} />
    </AppShell>
  )
}
