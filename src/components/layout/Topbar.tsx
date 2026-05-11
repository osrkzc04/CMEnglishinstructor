"use client"

import Link from "next/link"
import type { Route } from "next"
import { Bell, MessageSquare, Moon, PanelLeft, Search, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/layout/sidebar-context"
import { useTheme } from "@/components/theme/ThemeProvider"

/**
 * Topbar light — replica design-mockups/Dashboard.html:909-955 + Widgets.html
 * override 532-583.
 *
 * Patrón:
 *   [collapse-btn] [crumbs]  ↔  [search ⌘K] [theme] | [bell·dot] [msg] [CTA]
 *
 * El header live sobre var(--surface) (white en light, ink-850 en dark) con un
 * border-bottom 1px y una sombra mínima. El sidebar oscuro sigue debajo en
 * vertical: la asimetría dark-vertical / light-horizontal es la firma.
 */

export type Breadcrumb = {
  label: string
  href?: Route
}

export type TopbarCTA = {
  label: string
  /** JSX del icono ya renderizado. Pasalo desde la page como
   *  `icon={<Plus size={14} strokeWidth={1.6} />}` — no la referencia a la
   *  función Lucide directa, porque el componente no cruza el RSC boundary. */
  icon?: React.ReactNode
  href?: Route
  onClick?: () => void
}

type TopbarProps = {
  breadcrumbs: Breadcrumb[]
  cta?: TopbarCTA
}

export function Topbar({ breadcrumbs, cta }: TopbarProps) {
  const { toggle: toggleSidebar } = useSidebar()

  return (
    <header
      className={cn(
        "border-border bg-surface sticky top-0 z-[5] flex h-[60px] items-center gap-4 border-b px-7",
        "shadow-[0_1px_0_rgba(35,54,65,0.04),_0_6px_18px_rgba(35,54,65,0.05)]",
      )}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Colapsar menú"
        title="Colapsar menú"
        className="border-border text-text-3 hover:border-border-strong hover:bg-background hover:text-foreground grid h-8 w-8 shrink-0 place-items-center rounded-md border transition-colors duration-[150ms]"
      >
        <PanelLeft size={16} strokeWidth={1.6} />
      </button>

      {/* Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="text-text-3 flex shrink-0 items-center gap-2.5 text-[14px]"
      >
        {breadcrumbs.map((b, i) => {
          const isLast = i === breadcrumbs.length - 1
          return (
            <span key={`${b.label}-${i}`} className="flex items-center gap-2.5">
              {i > 0 && <span className="text-text-4">/</span>}
              {isLast ? (
                <span className="text-foreground font-serif text-[15px] tracking-[-0.005em] italic">
                  {b.label}
                </span>
              ) : b.href ? (
                <Link href={b.href} className="text-text-3 hover:text-foreground transition-colors">
                  {b.label}
                </Link>
              ) : (
                <span>{b.label}</span>
              )}
            </span>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* Search */}
      <SearchBox />

      {/* Action group */}
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />

        <span aria-hidden className="bg-border mx-1 h-9 w-px" />

        <IconButton title="Notificaciones" hasDot>
          <Bell size={16} strokeWidth={1.6} />
        </IconButton>
        <IconButton title="Mensajes">
          <MessageSquare size={16} strokeWidth={1.6} />
        </IconButton>

        {cta && <CtaButton cta={cta} />}
      </div>
    </header>
  )
}

// -----------------------------------------------------------------------------
//  SearchBox
// -----------------------------------------------------------------------------

function SearchBox() {
  return (
    <div className="relative hidden flex-1 md:block md:max-w-[380px]">
      <span
        aria-hidden
        className="text-text-4 pointer-events-none absolute top-1/2 left-[11px] -translate-y-1/2"
      >
        <Search size={14} strokeWidth={1.6} />
      </span>
      <input
        type="text"
        placeholder="Buscar estudiantes, clases, materiales…"
        className={cn(
          "border-border bg-background text-foreground placeholder:text-text-4 w-full rounded-md border py-[9px] pr-12 pl-[34px] text-[14px]",
          "hover:border-border-strong transition-colors duration-[150ms]",
          "focus:bg-surface focus:border-teal-500 focus:outline-none",
        )}
      />
      <span
        aria-hidden
        className="border-border text-text-3 pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-sm border px-1.5 py-px font-mono text-[10.5px] leading-none"
      >
        ⌘K
      </span>
    </div>
  )
}

// -----------------------------------------------------------------------------
//  ThemeToggle (segmented sun/moon, 2 estados)
// -----------------------------------------------------------------------------

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <div
      role="tablist"
      aria-label="Modo"
      className="border-border bg-background inline-flex items-center rounded-md border p-0.5"
    >
      <button
        type="button"
        role="tab"
        aria-pressed={!isDark}
        title="Claro"
        onClick={() => setTheme("light")}
        className={cn(
          "grid h-7 w-7 place-items-center rounded-[5px] transition-colors duration-[150ms]",
          !isDark
            ? "bg-ink-900 text-bone dark:bg-bone dark:text-ink-900"
            : "text-text-3 hover:text-foreground",
        )}
      >
        <Sun size={13} strokeWidth={1.6} />
      </button>
      <button
        type="button"
        role="tab"
        aria-pressed={isDark}
        title="Oscuro"
        onClick={() => setTheme("dark")}
        className={cn(
          "grid h-7 w-7 place-items-center rounded-[5px] transition-colors duration-[150ms]",
          isDark
            ? "bg-ink-900 text-bone dark:bg-bone dark:text-ink-900"
            : "text-text-3 hover:text-foreground",
        )}
      >
        <Moon size={13} strokeWidth={1.6} />
      </button>
    </div>
  )
}

// -----------------------------------------------------------------------------
//  IconButton — para bell, messages, etc.
// -----------------------------------------------------------------------------

function IconButton({
  children,
  title,
  hasDot,
}: {
  children: React.ReactNode
  title: string
  hasDot?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className="text-text-3 hover:border-border hover:bg-background hover:text-foreground relative inline-flex items-center gap-1.5 rounded-md border border-transparent p-2 transition-[background-color,color,border-color] duration-[120ms]"
    >
      {children}
      {hasDot && (
        <span
          aria-hidden
          className="ring-surface absolute top-[5px] right-[5px] h-1.5 w-1.5 rounded-full bg-teal-500 ring-[1.5px]"
        />
      )}
    </button>
  )
}

// -----------------------------------------------------------------------------
//  CtaButton — primary del header
// -----------------------------------------------------------------------------

function CtaButton({ cta }: { cta: TopbarCTA }) {
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-md border border-ink-900 bg-ink-900 px-3 py-2 text-[13.5px] leading-none text-bone transition-colors duration-[120ms]",
    "hover:border-teal-500 hover:bg-teal-500",
    "dark:border-bone dark:bg-bone dark:text-ink-900 dark:hover:border-teal-500 dark:hover:bg-teal-500 dark:hover:text-bone",
  )

  if (cta.href) {
    return (
      <Link href={cta.href} className={className}>
        {cta.icon}
        {cta.label}
      </Link>
    )
  }
  return (
    <button type="button" onClick={cta.onClick} className={className}>
      {cta.icon}
      {cta.label}
    </button>
  )
}
