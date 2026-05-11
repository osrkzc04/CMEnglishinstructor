import type { Route } from "next"
import type { LucideIcon } from "lucide-react"
import { Construction } from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import type { Role } from "@prisma/client"

/**
 * Shell genérico para vistas que aún no están implementadas. Usa el mismo
 * AppShell que el resto, así el rol no pierde contexto de navegación —
 * solo el área de contenido muestra el estado "en construcción".
 */

type Props = {
  /** Roles autorizados a ver la ruta (delega al guard estándar). */
  allowedRoles: Role[]
  /** Eyebrow superior — sección a la que pertenece la ruta. */
  section: string
  /** Título grande mostrado en el header. */
  title: string
  /** Texto secundario (opcional) bajo el título. */
  description?: string
  /** Crumbs intermedios — el último (label sin href) lo agrega el componente. */
  breadcrumbs: { label: string; href?: Route }[]
  /** Icono opcional dentro del estado vacío. */
  icon?: LucideIcon
}

export async function UnderConstructionShell({
  allowedRoles,
  section,
  title,
  description,
  breadcrumbs,
  icon: Icon = Construction,
}: Props) {
  const user = await requireRole(allowedRoles)

  return (
    <AppShell
      role={user.role!}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role!),
      }}
      breadcrumbs={[...breadcrumbs, { label: title }]}
    >
      <header className="mb-7 max-w-2xl">
        <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-text-3">
          {section}
        </p>
        <h1 className="font-serif text-[32px] font-normal leading-[1.18] tracking-[-0.02em]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-[14px] leading-[1.55] text-text-3">
            {description}
          </p>
        )}
      </header>

      <section className="rounded-2xl border border-dashed border-border-strong bg-surface p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-alt text-text-3">
          <Icon size={20} strokeWidth={1.6} />
        </div>
        <h2 className="mt-3.5 font-serif text-[18px] italic font-light tracking-[-0.01em]">
          Esta vista está en construcción
        </h2>
        <p className="mx-auto mt-1 max-w-[420px] text-[13.5px] text-text-2">
          La estamos terminando. Mientras tanto seguís con normalidad desde el
          resto del menú.
        </p>
      </section>
    </AppShell>
  )
}
