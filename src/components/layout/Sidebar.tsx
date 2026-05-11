"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Role } from "@prisma/client"
import { cn } from "@/lib/utils"
import { BrandMark, BrandWordmark } from "@/components/layout/BrandMark"
import { useSidebar } from "@/components/layout/sidebar-context"
import { UserMenu } from "@/components/layout/UserMenu"
import {
  adminNav,
  studentNav,
  teacherNav,
  type NavBadge,
  type NavGroup,
  type NavItem,
} from "@/components/layout/navigation"

/**
 * Sidebar dark — chrome de la app (siempre ink-900, sin importar el tema).
 *
 * Replica design-mockups/Layout.html:537-622:
 *  - Width 248px expandido / 64px colapsado, con transición de 250ms.
 *  - Brand 60px alto con border-bottom ink-700.
 *  - Secciones con eyebrow mono caps tracking 0.1em.
 *  - Items: icon + label + badge optional. Activo con barra teal 2px a left:-10px.
 *  - Foot con UserMenu.
 *
 * El estado colapsado vive en SidebarProvider (lo controla el toggle del Topbar)
 * y persiste en localStorage["cm-sidebar"].
 */

const NAV_BY_ROLE: Record<Role, NavGroup[]> = {
  DIRECTOR: adminNav,
  COORDINATOR: adminNav,
  TEACHER: teacherNav,
  STUDENT: studentNav,
}

type SidebarProps = {
  role: Role
  user: {
    name: string
    roleLabel: string
  }
}

export function Sidebar({ role, user }: SidebarProps) {
  const { isCollapsed } = useSidebar()
  const groups = NAV_BY_ROLE[role]

  return (
    <aside
      data-collapsed={isCollapsed || undefined}
      className={cn(
        "border-ink-700 bg-ink-900 text-bone sticky top-0 z-10 hidden h-screen flex-col overflow-hidden border-r transition-[width] duration-[250ms] ease-out lg:flex",
        isCollapsed ? "w-[64px]" : "w-[248px]",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "border-ink-700 flex h-[60px] flex-none items-center gap-2.5 border-b",
          isCollapsed ? "justify-center px-0" : "px-[18px]",
        )}
      >
        <BrandMark className="text-bone" size={22} />
        {!isCollapsed && <BrandWordmark className="text-bone" />}
      </div>

      {/* Nav scroll area */}
      <nav
        className={cn(
          "min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
          isCollapsed ? "px-2 pt-1 pb-4" : "px-[10px] pt-1 pb-4",
        )}
      >
        {groups.map((group, idx) => (
          <NavSection
            key={group.label ?? `g-${idx}`}
            group={group}
            isFirst={idx === 0}
            isCollapsed={isCollapsed}
          />
        ))}
      </nav>

      {/* User foot */}
      <div className={cn("border-ink-700 flex-none border-t", isCollapsed ? "p-2" : "p-3")}>
        <UserMenu name={user.name} roleLabel={user.roleLabel} isCollapsed={isCollapsed} />
      </div>
    </aside>
  )
}

// -----------------------------------------------------------------------------
//  NavSection
// -----------------------------------------------------------------------------

function NavSection({
  group,
  isFirst,
  isCollapsed,
}: {
  group: NavGroup
  isFirst: boolean
  isCollapsed: boolean
}) {
  const pathname = usePathname() ?? ""
  return (
    <div>
      {!isCollapsed && group.label ? (
        <div
          className={cn(
            "text-bone/60 flex items-center justify-between px-2 pb-1.5 font-mono text-[11.5px] tracking-[0.1em] uppercase",
            isFirst ? "mt-1.5" : "mt-4",
          )}
        >
          <span>{group.label}</span>
          {typeof group.count === "number" && (
            <span className="text-bone/40 text-[10px]">
              {group.count.toString().padStart(2, "0")}
            </span>
          )}
        </div>
      ) : null}
      <ul className="flex flex-col">
        {group.items.map((item) => (
          <li key={item.href}>
            <NavEntry item={item} pathname={pathname} isCollapsed={isCollapsed} />
          </li>
        ))}
      </ul>
    </div>
  )
}

// -----------------------------------------------------------------------------
//  NavEntry — item del sidebar
// -----------------------------------------------------------------------------

function NavEntry({
  item,
  pathname,
  isCollapsed,
}: {
  item: NavItem
  pathname: string
  isCollapsed: boolean
}) {
  const Icon = item.icon
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      data-label={isCollapsed ? item.label : undefined}
      className={cn(
        // base
        "group relative my-px flex items-center gap-[11px] rounded-md border border-transparent text-[14px] transition-[background-color,color,border-color] duration-[120ms] ease-out",
        isCollapsed ? "justify-center px-0 py-2.5" : "px-2.5 py-2",
        // estados
        isActive
          ? "border-ink-700 bg-bone/[0.06] text-bone"
          : "text-bone/[0.78] hover:bg-bone/[0.05] hover:text-bone",
        // tooltip cuando está colapsado
        isCollapsed &&
          "after:border-ink-600 after:bg-ink-700 after:text-bone after:pointer-events-none after:absolute after:top-1/2 after:left-[calc(100%+12px)] after:z-20 after:-translate-y-1/2 after:rounded-md after:border after:px-[9px] after:py-[5px] after:text-[12px] after:opacity-0 after:transition-opacity after:duration-[120ms] after:content-[attr(data-label)] hover:after:opacity-100",
      )}
    >
      {/* Indicador activo: barra teal 2px a la izquierda */}
      {isActive && (
        <span
          aria-hidden
          className={cn(
            "absolute top-2 bottom-2 w-[2px] rounded-r bg-teal-500",
            isCollapsed ? "-left-2" : "-left-2.5",
          )}
        />
      )}

      <Icon
        size={18}
        strokeWidth={1.6}
        className={cn(
          "shrink-0 transition-colors",
          isActive ? "text-teal-500" : "text-bone/[0.55] group-hover:text-bone",
        )}
      />

      {!isCollapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && <NavBadgeView badge={item.badge} />}
        </>
      )}
    </Link>
  )
}

// -----------------------------------------------------------------------------
//  NavBadge — pill mono pequeño
// -----------------------------------------------------------------------------

function NavBadgeView({ badge }: { badge: NavBadge }) {
  const value = badge.kind === "count" ? badge.value.toString() : badge.value
  const tone = badge.tone ?? "default"

  return (
    <span
      className={cn(
        "shrink-0 rounded-sm border px-1.5 py-px font-mono text-[11.5px] leading-[1.5]",
        tone === "teal"
          ? "border-teal-500/50 bg-teal-500/10 text-teal-500"
          : tone === "warning"
            ? "border-warning/35 bg-warning/10 text-warning"
            : "border-bone/[0.18] text-bone/60",
      )}
    >
      {value}
    </span>
  )
}
