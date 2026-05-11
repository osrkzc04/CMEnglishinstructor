"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Menu, X, ArrowRight } from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/layout/BrandMark"
import { cn } from "@/lib/utils"

/**
 * Topbar de la landing pública. Sticky, light surface con backdrop-blur.
 * Cuatro comportamientos clave:
 *
 *   1. Sombra de scroll → al pasar 80px, aparece una sombra sutil bajo el
 *      topbar como indicador discreto. La altura se mantiene constante
 *      (60px) para evitar saltos visuales que descuadren los links contra
 *      los botones de la derecha.
 *   2. Indicador de sección activa → IntersectionObserver detecta qué
 *      sección está en la franja superior-media del viewport y subraya el
 *      link correspondiente con teal-500.
 *   3. CTA primario "Conversemos" → botón teal a la derecha, ancla a
 *      `#contacto`. Empuja conversión desde cualquier punto del scroll.
 *   4. Drawer mobile → debajo de `lg` aparece un botón hamburguesa que
 *      abre un panel lateral con todos los anchors + CTAs.
 *
 * Las transiciones respetan `prefers-reduced-motion` por el patrón de
 * Tailwind (motion-safe / motion-reduce automáticos en utilities standard).
 */

/**
 * Lista completa de secciones que el observer rastrea (para detectar la
 * activa). El drawer mobile las muestra todas; la nav desktop solo
 * renderiza las que tienen `desktop: true`.
 *
 * Estructura clásica para el desktop: Inicio · Sobre Nosotros · Programas
 * · Preguntas Frecuentes · Contáctanos. Las secciones intermedias
 * (Modalidades, Por qué CM, Cómo trabajamos) viven en la página y se
 * pueden encontrar via scroll o desde el drawer mobile, pero no compiten
 * por espacio en el topbar.
 *
 * Nota: el CTA "Conversemos" comparte destino con "Contáctanos" pero su
 * tratamiento visual (botón teal vs link de texto) los diferencia: uno es
 * navegación, el otro conversión. Convive bien.
 */
const NAV_SECTIONS = [
  { id: "inicio", label: "Inicio", desktop: true },
  { id: "nosotros", label: "Sobre Nosotros", desktop: true },
  { id: "programas", label: "Programas", desktop: true },
  { id: "modalidades", label: "Modalidades", desktop: false },
  { id: "por-que", label: "Por qué CM", desktop: false },
  { id: "proceso", label: "Cómo trabajamos", desktop: false },
  { id: "preguntas", label: "Preguntas Frecuentes", desktop: true },
  { id: "contacto", label: "Contáctanos", desktop: true },
] as const

const SCROLL_THRESHOLD = 80

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  // Detector de scroll: solo dispara la sombra debajo del topbar.
  // La altura del header no cambia para no descuadrar links vs. botones.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Indicador de sección activa: una sección entra en estado activo cuando
  // su top cruza la franja entre 35% y 45% del viewport (ese rango se logra
  // con el `rootMargin` negativo arriba y abajo).
  useEffect(() => {
    const targets = NAV_SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (targets.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: "-35% 0% -55% 0%", threshold: 0 },
    )

    targets.forEach((t) => observer.observe(t))
    return () => observer.disconnect()
  }, [])

  // Body-scroll lock cuando el drawer mobile está abierto.
  useEffect(() => {
    if (!mobileOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = original
    }
  }, [mobileOpen])

  // Cerrar drawer al pasar de mobile a desktop (resize cross-breakpoint).
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return (
    <>
      <header
        className={cn(
          "border-ink-700/40 bg-ink-900 text-bone sticky top-0 z-30 h-[60px] border-b transition-shadow duration-300 ease-out",
          scrolled && "shadow-[0_1px_0_rgba(35,54,65,0.5),0_12px_32px_-16px_rgba(0,0,0,0.45)]",
        )}
      >
        <div className="mx-auto flex h-full w-full max-w-[1180px] items-center px-6">
          {/* Brand */}
          <Link
            href="/"
            className="text-bone hover:text-bone flex items-center gap-2.5 transition-colors"
            aria-label="CM English Instructor — inicio"
          >
            <BrandMark className="text-bone" size={22} />
            <BrandWordmark className="text-bone" size="sm" />
          </Link>

          {/* Grupo derecho: nav + divisor + botones */}
          <div className="ml-auto flex items-center gap-6">
            <nav
              aria-label="Secciones"
              className="text-bone/65 hidden items-center gap-6 text-[15px] lg:flex"
            >
              {NAV_SECTIONS.filter((s) => s.desktop).map((section) => (
                <NavLink
                  key={section.id}
                  href={`#${section.id}`}
                  active={activeSection === section.id}
                >
                  {section.label}
                </NavLink>
              ))}
            </nav>

            {/* Divisor editorial entre nav y botones */}
            <span aria-hidden className="bg-bone/15 hidden h-6 w-px shrink-0 lg:block" />

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="border-bone/20 text-bone/85 hover:border-bone/40 hover:bg-bone/5 hover:text-bone hidden h-10 items-center rounded-md border bg-transparent px-4 text-[14.5px] transition-colors md:inline-flex"
              >
                Ingresar
              </Link>
              <a
                href="#contacto"
                className="group text-bone hidden h-10 items-center gap-1.5 rounded-md bg-teal-500 px-4 text-[14.5px] font-medium transition-colors hover:bg-teal-700 md:inline-flex"
              >
                Conversemos
                <ArrowRight
                  size={14}
                  strokeWidth={1.6}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </a>

              {/* Hamburger mobile */}
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menú"
                aria-expanded={mobileOpen}
                className="border-bone/20 text-bone hover:border-bone/40 hover:bg-bone/5 inline-flex h-9 w-9 items-center justify-center rounded-md border bg-transparent transition-colors lg:hidden"
              >
                <Menu size={18} strokeWidth={1.6} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        activeSection={activeSection}
      />
    </>
  )
}

// -----------------------------------------------------------------------------
//  Desktop nav link con underline teal de sección activa
// -----------------------------------------------------------------------------

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "relative py-1 transition-colors duration-200",
        active ? "text-bone" : "hover:text-bone",
      )}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "absolute right-0 -bottom-0.5 left-0 h-px bg-teal-500 transition-transform duration-300 ease-out",
          active ? "scale-x-100" : "scale-x-0",
        )}
      />
    </a>
  )
}

// -----------------------------------------------------------------------------
//  Drawer mobile
// -----------------------------------------------------------------------------

function MobileDrawer({
  open,
  onClose,
  activeSection,
}: {
  open: boolean
  onClose: () => void
  activeSection: string | null
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Cerrar menú"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={cn(
          "bg-ink-950/65 fixed inset-0 z-40 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        aria-hidden={!open}
        className={cn(
          "bg-ink-900 text-bone fixed top-0 right-0 z-50 flex h-full w-full max-w-[360px] flex-col shadow-[-12px_0_32px_-12px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:hidden",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="border-bone/10 flex h-[60px] shrink-0 items-center justify-between border-b px-6">
          <span className="text-bone/55 font-mono text-[11px] tracking-[0.12em] uppercase">
            Menú
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="border-bone/20 text-bone hover:border-bone/40 hover:bg-bone/5 inline-flex h-9 w-9 items-center justify-center rounded-md border bg-transparent transition-colors"
          >
            <X size={18} strokeWidth={1.6} />
          </button>
        </div>

        <nav aria-label="Secciones" className="flex flex-1 flex-col overflow-y-auto px-6 pt-2">
          {NAV_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={onClose}
              aria-current={activeSection === section.id ? "true" : undefined}
              className={cn(
                "border-bone/10 border-b py-4 font-serif text-[20px] tracking-[-0.01em] transition-colors",
                activeSection === section.id ? "text-teal-500" : "text-bone hover:text-teal-500",
              )}
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="border-bone/10 flex flex-col gap-2 border-t p-6">
          <a
            href="#contacto"
            onClick={onClose}
            className="group text-bone inline-flex items-center justify-center gap-2 rounded-md bg-teal-500 px-5 py-3 text-[14px] font-medium transition-colors hover:bg-teal-700"
          >
            Conversemos
            <ArrowRight
              size={15}
              strokeWidth={1.6}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </a>
          <Link
            href="/postular-docente"
            onClick={onClose}
            className="border-bone/20 text-bone/85 hover:border-bone/40 hover:bg-bone/5 hover:text-bone inline-flex items-center justify-center rounded-md border bg-transparent px-5 py-3 text-[14px] transition-colors"
          >
            Postular como docente
          </Link>
          <Link
            href="/login"
            onClick={onClose}
            className="border-bone/20 text-bone/85 hover:border-bone/40 hover:bg-bone/5 hover:text-bone inline-flex items-center justify-center rounded-md border bg-transparent px-5 py-3 text-[14px] transition-colors"
          >
            Ingresar
          </Link>
        </div>
      </aside>
    </>
  )
}
