import Link from "next/link"
import type { Route } from "next"
import { Mail, Phone } from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/layout/BrandMark"

/**
 * Footer del landing. Estructura editorial en 4 columnas en desktop —
 * marca, navegación, acceso, contacto — y bottom bar discreta con
 * copyright + ubicación + dominio.
 *
 * Decisiones:
 *   - El tagline "Helping everyone communicate." vive aquí desde que se
 *     retiró `MarketingCloser`. En tipografía mono caps no compite con el
 *     resto del footer y mantiene la frase de marca en algún lugar público.
 *   - Los anchors apuntan a las secciones del landing tal como quedaron
 *     después del rediseño del nav (incluye Sobre Nosotros y los nuevos
 *     labels clásicos).
 *   - "Acceso" agrupa las tres rutas que sacan del flujo de descubrimiento:
 *     contactarnos (anchor), postular como docente (form público) y
 *     ingresar (auth).
 *   - "Contacto" repite el bloque que está dentro de la sección Contacto
 *     porque el footer es la última oportunidad de captar al visitante
 *     antes de que cierre la pestaña — tener los correos y teléfonos a un
 *     scroll de distancia importa más que evitar la duplicación.
 */
export function MarketingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-border bg-background border-t">
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-14 pb-10">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1.2fr] md:gap-12">
          <div className="flex flex-col gap-5">
            <Link
              href="/"
              className="text-foreground inline-flex items-center gap-2.5"
              aria-label="CM English Instructor — inicio"
            >
              <BrandMark className="text-foreground" size={22} />
              <BrandWordmark className="text-foreground" size="sm" />
            </Link>
            <p className="text-text-3 max-w-[300px] text-[13.5px] leading-[1.6]">
              Academia de inglés y español dirigida por Carolina Monsalve, Certified English &amp;
              Spanish Instructor.
            </p>
            <p className="text-text-2 font-serif text-[15px] leading-[1.45] italic">
              Helping <span className="text-teal-500">everyone</span> communicate.
            </p>
          </div>

          <FooterColumn title="Navegar">
            <AnchorLink href="#inicio">Inicio</AnchorLink>
            <AnchorLink href="#nosotros">Sobre Nosotros</AnchorLink>
            <AnchorLink href="#programas">Programas</AnchorLink>
            <AnchorLink href="#modalidades">Modalidades</AnchorLink>
            <AnchorLink href="#por-que">Por qué CM</AnchorLink>
            <AnchorLink href="#proceso">Cómo trabajamos</AnchorLink>
            <AnchorLink href="#preguntas">Preguntas Frecuentes</AnchorLink>
          </FooterColumn>

          <FooterColumn title="Acceso">
            <AnchorLink href="#contacto">Contáctanos</AnchorLink>
            <RouteLink href="/postular-docente">Postular como docente</RouteLink>
            <RouteLink href="/login">Ingresar</RouteLink>
          </FooterColumn>

          <FooterColumn title="Contacto">
            <FooterIconLink
              icon={<Mail size={13} strokeWidth={1.6} />}
              href="mailto:cmonsalve@cmenglishinstructor.com"
            >
              cmonsalve@cmenglishinstructor.com
            </FooterIconLink>
            <FooterIconLink
              icon={<Mail size={13} strokeWidth={1.6} />}
              href="mailto:info@cmenglishinstructor.com"
            >
              info@cmenglishinstructor.com
            </FooterIconLink>
            <FooterIconLink icon={<Phone size={13} strokeWidth={1.6} />} href="tel:+593958747016">
              +593 958 74 70 16
            </FooterIconLink>
            <FooterIconLink icon={<Phone size={13} strokeWidth={1.6} />} href="tel:+593992526619">
              +593 992 52 66 19
            </FooterIconLink>
          </FooterColumn>
        </div>
      </div>

      <div className="border-border border-t">
        <div className="text-text-3 mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-3 px-6 py-5 font-mono text-[11px] tracking-[0.06em] uppercase">
          <span>© {year} CM English Instructor</span>
          <span className="hidden sm:inline">Quito · Ecuador</span>
          <span>cmenglishinstructor.com</span>
        </div>
      </div>
    </footer>
  )
}

// -----------------------------------------------------------------------------
//  Sub-componentes
// -----------------------------------------------------------------------------

const FOOTER_LINK_CLS = "text-text-2 transition-colors hover:text-foreground"

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-4 font-mono text-[10.5px] tracking-[0.12em] uppercase">{title}</p>
      <div className="flex flex-col gap-2.5 text-[13.5px]">{children}</div>
    </div>
  )
}

function AnchorLink({ href, children }: { href: `#${string}`; children: React.ReactNode }) {
  return (
    <a href={href} className={FOOTER_LINK_CLS}>
      {children}
    </a>
  )
}

function RouteLink({ href, children }: { href: Route; children: React.ReactNode }) {
  return (
    <Link href={href} className={FOOTER_LINK_CLS}>
      {children}
    </Link>
  )
}

function FooterIconLink({
  icon,
  href,
  children,
}: {
  icon: React.ReactNode
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      className="group text-text-2 inline-flex items-center gap-2 transition-colors hover:text-teal-500"
    >
      <span className="text-text-4 transition-colors group-hover:text-teal-500">{icon}</span>
      <span className="truncate">{children}</span>
    </a>
  )
}
