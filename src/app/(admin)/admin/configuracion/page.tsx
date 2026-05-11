import type { Route } from "next"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, BookOpen, Layers, Settings as SettingsIcon } from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"

export const metadata: Metadata = { title: "Configuración" }

const SECTIONS: {
  href: Route
  title: string
  description: string
  icon: typeof Layers
  status: "available" | "soon"
}[] = [
  {
    href: "/admin/configuracion/niveles" as Route,
    title: "Niveles del catálogo",
    description:
      "Crear, editar y desactivar niveles. Definir las horas totales contratadas por nivel.",
    icon: Layers,
    status: "available",
  },
  {
    href: "/admin/configuracion/cursos" as Route,
    title: "Cursos y programas",
    description:
      "Estructura del catálogo: idiomas, cursos y programas que agrupan a los niveles.",
    icon: BookOpen,
    status: "soon",
  },
  {
    href: "/admin/configuracion/sistema" as Route,
    title: "Parámetros del sistema",
    description:
      "Duración de clase por defecto, carga semanal mínima/máxima por aula y política de ausencias.",
    icon: SettingsIcon,
    status: "available",
  },
]

export default async function AdminConfiguracionPage() {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])

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
        { label: "Configuración" },
      ]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
          Sistema
        </p>
        <h1 className="font-serif text-[32px] font-normal leading-[1.18] tracking-[-0.02em]">
          Configuración
        </h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-text-3">
          Catálogo y parámetros globales. Lo que cambies acá impacta a las
          aulas y matrículas que se creen de aquí en adelante.
        </p>
      </header>

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon
          const inner = (
            <>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-surface-alt text-text-3">
                <Icon size={15} strokeWidth={1.6} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-medium text-foreground">{section.title}</h2>
                  {section.status === "available" ? (
                    <ArrowUpRight
                      size={14}
                      strokeWidth={1.6}
                      className="shrink-0 text-text-3 transition-colors group-hover:text-teal-500"
                    />
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-4">
                      próximamente
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12.5px] text-text-3">
                  {section.description}
                </p>
              </div>
            </>
          )
          return (
            <li key={section.href}>
              {section.status === "available" ? (
                <Link
                  href={section.href}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-teal-500"
                >
                  {inner}
                </Link>
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 opacity-60">
                  {inner}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </AppShell>
  )
}
