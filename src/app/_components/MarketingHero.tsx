import Image from "next/image"
import { ArrowRight } from "lucide-react"

/**
 * Hero editorial. Composición en capas (de atrás hacia adelante):
 *
 *   1. Foto de fondo con tratamiento duotono ink+bone (grayscale + opacidad
 *      baja + blend mode). Hoy es un placeholder de Unsplash; reemplazable
 *      dropeando una imagen en `/public/landing/hero.jpg` y cambiando
 *      `HERO_PHOTO_SRC` a `"/landing/hero.jpg"`.
 *   2. Grid milimétrico ink-tinted (mismo lenguaje del login pero adaptado
 *      a fondo bone).
 *   3. Glows radiales teal/ink — anclas de luz editorial.
 *   4. Decorativo: ampersand serif italic gigante en la esquina inferior
 *      derecha al ~3% de opacidad.
 *   5. Fade-out vertical hacia la siguiente sección.
 *
 * Sobre eso, grid 1.1fr / 1fr: izquierda → propuesta + CTAs + stats;
 * derecha → panel ink-900 con la quote de marca.
 *
 * Animaciones: stagger de entrada con la utility `.rise` (globals.css).
 * Cada bloque define `--rise-delay` inline para encadenar. Respeta
 * `prefers-reduced-motion` automáticamente.
 */

/**
 * URL de la foto del hero. Reemplázala con la foto oficial cuando esté:
 *   - Local: "/landing/hero.jpg" (colocar archivo en /public/landing/)
 *   - Externa: cualquier URL del dominio permitido en next.config.ts
 *
 * Si se establece en `null` se cae al fondo 100% abstracto.
 */
const HERO_PHOTO_SRC: string | null =
  "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=2400&q=80"

/**
 * Retrato de la directora académica para la card del hero.
 *
 * IMPORTANTE: Hoy es un placeholder de Unsplash. Reemplazar por la foto
 * oficial de Carolina cuando esté disponible:
 *   1. Coloca la imagen en /public/landing/carolina.jpg
 *      (sugerido 1200×1500 jpg/webp, retrato vertical, fondo neutro)
 *   2. Cambia `INSTRUCTOR_PHOTO_SRC` a "/landing/carolina.jpg"
 */
const INSTRUCTOR_PHOTO_SRC: string =
  "/landing/team/carolina.jpg"

export function MarketingHero() {
  return (
    <section id="inicio" className="relative overflow-hidden">
      <HeroBackdrop />

      <div className="relative mx-auto grid w-full max-w-[1180px] items-center gap-12 px-6 py-20 md:py-28 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <p
            className="rise mb-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-text-3"
            style={{ ["--rise-delay" as string]: "0ms" }}
          >
            <span aria-hidden className="h-px w-8 bg-text-4" />
            Academia de inglés y español
          </p>

          <h1
            className="rise m-0 font-serif text-[44px] leading-[1.05] tracking-[-0.02em] text-foreground sm:text-[56px] lg:text-[64px]"
            style={{ ["--rise-delay" as string]: "80ms" }}
          >
            Inglés{" "}
            <em className="font-light italic text-text-2">con propósito</em>,
            enseñado <br className="hidden sm:block" />
            con la calidez de quien
            <em className="font-light italic text-text-2"> conoce tu ritmo</em>
            .
          </h1>

          <p
            className="rise mt-7 max-w-[540px] text-[17px] leading-[1.65] text-text-2"
            style={{ ["--rise-delay" as string]: "200ms" }}
          >
            Inglés y español para ejecutivos, equipos, adolescentes y niños.
            Cada plan se arma alrededor de tu nivel, tu objetivo y los horarios
            que tienes — sin moldes prefabricados.
          </p>

          <div
            className="rise mt-9 flex flex-wrap items-center gap-3"
            style={{ ["--rise-delay" as string]: "320ms" }}
          >
            <a
              href="#contacto"
              className="group inline-flex items-center gap-2 rounded-md bg-ink-900 px-5 py-3 text-[14px] font-medium text-bone transition-colors hover:bg-teal-500 dark:bg-bone dark:text-ink-900 dark:hover:bg-teal-500 dark:hover:text-bone"
            >
              Conversemos
              <ArrowRight
                size={15}
                strokeWidth={1.6}
                className="transition-transform duration-200 ease-out group-hover:translate-x-0.5"
              />
            </a>
            <a
              href="#programas"
              className="inline-flex items-center rounded-md border border-border bg-surface/80 px-5 py-3 text-[14px] text-foreground backdrop-blur-sm transition-colors hover:border-border-strong hover:bg-surface"
            >
              Ver programas
            </a>
          </div>

          <dl
            className="rise mt-12 grid max-w-[520px] grid-cols-3 gap-6 border-t border-border pt-7"
            style={{ ["--rise-delay" as string]: "440ms" }}
          >
            <Stat label="Niveles MCER" value="A1 — C2" />
            <Stat label="Modalidades" value="3" />
            <Stat
              label="Programas"
              value="6+"
              hint="General · Business · Kids · Spanish"
            />
          </dl>
        </div>

        {/* Foto-card de la directora — anclaje humano del hero */}
        <div
          className="rise"
          style={{ ["--rise-delay" as string]: "560ms" }}
        >
          <InstructorCard />
        </div>
      </div>
    </section>
  )
}

// -----------------------------------------------------------------------------
//  Background
// -----------------------------------------------------------------------------

/**
 * Composición de fondo del hero. Layers, de atrás hacia adelante:
 *   - Foto duotono (opcional, controlada por `HERO_PHOTO`)
 *   - Grid milimétrico bone-friendly
 *   - Glow teal radial (top-left)
 *   - Glow ink radial sutil (bottom-right)
 *   - Decorativo serif italic ampersand (bottom-right, ~3% opacity)
 *   - Fade vertical del bg al borde inferior (suaviza transición a la
 *     siguiente sección)
 */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {HERO_PHOTO_SRC ? (
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src={HERO_PHOTO_SRC}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-[0.32] [filter:grayscale(0.85)_contrast(1.05)_brightness(1.02)] mix-blend-multiply dark:opacity-[0.18] dark:mix-blend-screen"
          />
          {/* Tinte teal sutil sobre la foto — completa el duotono ink+teal
            * sin saturarla. */}
          <div className="absolute inset-0 bg-teal-500/[0.04] mix-blend-multiply dark:bg-teal-500/[0.06] dark:mix-blend-screen" />
        </div>
      ) : null}

      <div className="hero-grid-bg absolute inset-0" />
      <div className="hero-glow-teal absolute inset-0" />
      <div className="hero-glow-ink absolute inset-0" />

      {/* Decorativo: ampersand serif italic gigante en la esquina inferior
        * derecha. Editorial sin caer en ilustración. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -right-6 select-none font-serif text-[420px] italic leading-none text-ink-900/[0.05] dark:text-bone/[0.04] sm:-bottom-24 sm:-right-10 sm:text-[560px]"
      >
        &amp;
      </span>

      {/* Fade-out hacia el borde inferior — disuelve el grid antes de
        * tocar la sección "Programas". */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />
    </div>
  )
}

// -----------------------------------------------------------------------------
//  Foto-card de la directora académica
// -----------------------------------------------------------------------------

/**
 * Card vertical con retrato + firma + credencial. Personaliza el hero con
 * el primer elemento humano que ve el cliente al entrar a la página.
 *
 * La quote de marca ("Helping everyone communicate…") vive en la sección
 * `MarketingCloser` al final del landing — acá no se duplica para que el
 * statement no pierda peso por repetición.
 *
 * Estructura:
 *   - Foto duotono ink+bone (aspecto 5:6, top de la card)
 *   - Eyebrow "Dirección académica"
 *   - Nombre en Fraunces italic (tono manuscrito sin agregar font fuera del stack)
 *   - Flourish SVG teal (insinúa firma)
 *   - Credencial en mono caps con dash teal a la izquierda
 */
function InstructorCard() {
  return (
    <article className="relative overflow-hidden rounded-[14px] border border-border bg-ink-900 text-bone shadow-[0_1px_0_rgba(35,54,65,0.04),0_24px_60px_-30px_rgba(35,54,65,0.45)]">
      {/* Foto */}
      <div className="relative aspect-[5/6] overflow-hidden">
        <Image
          src={INSTRUCTOR_PHOTO_SRC}
          alt="Carolina Monsalve, directora académica de CM English Instructor"
          fill
          sizes="(min-width: 1024px) 540px, 100vw"
          className="object-cover object-top [filter:grayscale(0.85)_contrast(1.05)_brightness(0.98)]"
        />
        {/* Tinte ink + teal sobre la foto — duotono editorial */}
        <div aria-hidden className="absolute inset-0 bg-ink-900/30 mix-blend-multiply" />
        <div aria-hidden className="absolute inset-0 bg-teal-500/[0.08] mix-blend-screen" />
        {/* Vignette inferior — disuelve la foto contra el bg ink-900 del bloque
          * de texto, evitando un corte duro. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-ink-900"
        />
        {/* Eyebrow flotante sobre la foto */}
        <div className="absolute left-7 top-7 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-bone/75">
          <span aria-hidden className="h-px w-6 bg-teal-500" />
          Dirección académica
        </div>
      </div>

      {/* Texto */}
      <div className="px-7 pb-7 pt-2">
        <h3 className="m-0 font-serif text-[40px] font-light italic leading-[1.05] tracking-[-0.02em] text-bone sm:text-[44px]">
          Carolina Monsalve
        </h3>

        <SignatureFlourish className="mt-2 text-teal-500" />

        <div className="mt-4 space-y-1.5">
          <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-bone/65">
            <span aria-hidden className="h-px w-6 bg-teal-500" />
            Certified English &amp; Spanish Instructor
          </p>
          <p className="ml-8 font-mono text-[10.5px] uppercase tracking-[0.1em] text-bone/45">
            CELTA Cambridge · Authorised &amp; Certified Teacher
          </p>
        </div>
      </div>
    </article>
  )
}

/**
 * Flourish SVG inspirado en el remate de una firma manuscrita. Curva ligera
 * con leve elevación al final — sugiere "Carolina" sin caer en una webfont
 * script (que rompería el stack tipográfico aprobado).
 */
function SignatureFlourish({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      width="148"
      height="18"
      viewBox="0 0 148 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M 4 12 Q 28 2 56 9 T 112 7 Q 128 5 138 11" />
      <path d="M 138 11 L 144 8" opacity="0.7" />
    </svg>
  )
}

// -----------------------------------------------------------------------------
//  Stats
// -----------------------------------------------------------------------------

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
        {label}
      </dt>
      <dd className="mt-1.5 font-serif text-[26px] leading-none text-foreground">
        {value}
      </dd>
      {hint ? (
        <p className="mt-1 text-[12px] text-text-3">{hint}</p>
      ) : null}
    </div>
  )
}
