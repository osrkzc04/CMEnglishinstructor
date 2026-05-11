import Link from "next/link"
import type { Route } from "next"

/**
 * Footer global — design-mockups/Layout.html:714-729.
 * Mono caps a la izquierda con status indicator pulsante teal, links legales
 * a la derecha. Tono bajo, no compite con el contenido.
 */
export function AppFooter() {
  return (
    <footer className="border-border bg-background text-text-3 flex flex-col items-start justify-between gap-3 border-t px-10 py-[18px] font-mono text-[12.5px] tracking-[0.04em] sm:flex-row sm:items-center">
      <div className="flex items-center gap-3.5">
        <span className="text-text-2 inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="animate-pulse-status inline-block h-1.5 w-1.5 rounded-full bg-teal-500"
          />
          Sistemas operativos
        </span>
        <FooterDot />
        <span>v 1.0.0 · {currentVersion()}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3.5">
        <Link
          href={"/terminos" as Route}
          className="text-text-2 transition-colors hover:text-teal-500"
        >
          Términos
        </Link>
        <FooterDot />
        <Link
          href={"/privacidad" as Route}
          className="text-text-2 transition-colors hover:text-teal-500"
        >
          Privacidad
        </Link>
        <FooterDot />
        <Link
          href={"/documentacion" as Route}
          className="text-text-2 transition-colors hover:text-teal-500"
        >
          Documentación
        </Link>
        <FooterDot />
        <span>© {new Date().getFullYear()} CM English Instructor</span>
      </div>
    </footer>
  )
}

function FooterDot() {
  return <span aria-hidden className="bg-text-4 inline-block h-[3px] w-[3px] rounded-full" />
}

function currentVersion(): string {
  const now = new Date()
  return `${now.getFullYear()}.${(now.getMonth() + 1).toString().padStart(2, "0")}`
}
