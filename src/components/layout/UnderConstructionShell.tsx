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
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          {section}
        </p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          {title}
        </h1>
        {description && (
          <p className="text-text-3 mt-2 text-[14px] leading-[1.55]">{description}</p>
        )}
      </header>

      <section className="border-border-strong bg-surface rounded-2xl border border-dashed p-12 text-center">
        <div className="border-border bg-surface-alt text-text-3 mx-auto flex h-12 w-12 items-center justify-center rounded-full border">
          <Icon size={20} strokeWidth={1.6} />
        </div>
        <h2 className="mt-3.5 font-serif text-[18px] font-light tracking-[-0.01em] italic">
          Esta vista está en construcción
        </h2>
        <p className="text-text-2 mx-auto mt-1 max-w-[420px] text-[13.5px]">
          La estamos terminando. Mientras tanto seguís con normalidad desde el resto del menú.
        </p>
      </section>
    </AppShell>
  )
}
