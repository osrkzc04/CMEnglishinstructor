import Link from "next/link"
import { ArrowUpRight, GraduationCap } from "lucide-react"
import { Reveal } from "./Reveal"

/**
 * Banda de cierre del landing — captación de docentes.
 *
 * Reemplaza al `MarketingCloser` con la quote de marca: ahora el último
 * espacio antes del footer lo ocupa el llamado a postular como instructor.
 *
 * Composición:
 *   - Banda full-width ink-900 con grid milimétrico + glow teal radial
 *     (mismo lenguaje visual del aside del login y de la card del hero —
 *     bookends del sistema dark del producto).
 *   - Layout split: editorial a la izquierda + CTA bone a la derecha. En
 *     mobile se apila vertical.
 *   - El CTA va a `/postular-docente` (form público con su propio
 *     pipeline de validación + Turnstile + rate-limit). No abrimos en
 *     mailto porque la postulación pide datos estructurados.
 */
export function MarketingTeacherCta() {
  return (
    <section
      aria-labelledby="teacher-cta-title"
      className="bg-ink-900 text-bone relative overflow-hidden"
    >
      <TeacherCtaBackdrop />

      <div className="relative mx-auto w-full max-w-[1180px] px-6 py-20 md:py-24 lg:py-28">
        <Reveal>
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
            <div className="max-w-[640px]">
              <div className="border-bone/20 text-bone mb-5 inline-flex h-10 w-10 items-center justify-center rounded-full border">
                <GraduationCap size={18} strokeWidth={1.6} />
              </div>
              <p className="text-bone/60 font-mono text-[11px] tracking-[0.12em] uppercase">
                Súmate al equipo académico
              </p>
              <h2
                id="teacher-cta-title"
                className="text-bone mt-3 font-serif text-[34px] leading-[1.14] tracking-[-0.02em] sm:text-[42px]"
              >
                ¿Enseñas inglés o español?
              </h2>
              <p className="text-bone/75 mt-4 max-w-[520px] text-[15.5px] leading-[1.6]">
                Buscamos docentes con experiencia y método. Si te interesa formar parte de un equipo
                que cuida la calidad de cada clase, postula tu perfil y revisamos tu candidatura.
              </p>
            </div>

            <Link
              href="/postular-docente"
              className="group bg-bone text-ink-900 hover:text-bone inline-flex shrink-0 items-center gap-2 self-start rounded-md px-6 py-3.5 text-[14px] font-medium transition-colors hover:bg-teal-500 lg:self-auto"
            >
              Postular como docente
              <ArrowUpRight
                size={15}
                strokeWidth={1.6}
                className="transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function TeacherCtaBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="login-grid-bg absolute inset-0 opacity-60" />
      <div className="login-glow absolute inset-0" />
    </div>
  )
}
