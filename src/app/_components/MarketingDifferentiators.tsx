import { Reveal } from "./Reveal"

/**
 * Sección "Por qué CM English Instructor". Diferenciadores numerados estilo
 * editorial — cada uno con número grande Fraunces + título + bajada. Es el
 * "argumento de valor" que sigue a Programas/Modalidades antes de empujar
 * al CTA de contacto.
 */
const DIFFERENTIATORS = [
  {
    number: "01",
    title: "Currículo serio, no improvisado",
    description:
      "Trabajamos con programas publicados por National Geographic Learning, Pearson y Vistas. No armamos clases sobre la marcha ni mezclamos contenidos sin criterio.",
  },
  {
    number: "02",
    title: "Docentes que enseñan, no solo hablan",
    description:
      "La selección no se conforma con un nivel C1+. Evaluamos didáctica, claridad y trato — y la formación interna sigue después de la contratación.",
  },
  {
    number: "03",
    title: "Tu plan, tu ritmo",
    description:
      "Programa, modalidad, intensidad y duración se arman alrededor de tu rol, tu rutina y tu objetivo. Si algo cambia en el camino, el plan se reajusta.",
  },
  {
    number: "04",
    title: "Resultados que se ven",
    description:
      "Reportes claros de avance: en qué nivel estás hoy, qué temas dominas y cuándo proyectamos el siguiente paso. Sin sorpresas para personas o empresas.",
  },
]

export function MarketingDifferentiators() {
  return (
    <section
      id="por-que"
      className="border-t border-border bg-surface-alt/40 py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-[1180px] px-6">
        <Reveal as="header" className="mb-14 max-w-[720px]">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-text-3">
            Por qué CM English
          </p>
          <h2 className="font-serif text-[36px] leading-[1.12] tracking-[-0.02em] text-foreground sm:text-[44px]">
            Una academia que toma el aprendizaje
            <em className="font-light italic text-text-2"> en serio</em>.
          </h2>
          <p className="mt-4 text-[16px] leading-[1.65] text-text-2">
            Cuatro razones por las que estudiantes y empresas eligen seguir con
            nosotros nivel tras nivel.
          </p>
        </Reveal>

        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          {DIFFERENTIATORS.map((d, i) => (
            <Reveal key={d.number} delay={i * 80}>
              <article className="group flex gap-5 border-t border-border pt-6 transition-colors duration-300 hover:border-teal-500/40">
                <span className="font-serif text-[34px] font-light leading-none tracking-[-0.02em] text-text-3 transition-colors duration-300 group-hover:text-teal-500 sm:text-[40px]">
                  {d.number}
                </span>
                <div>
                  <h3 className="font-serif text-[22px] leading-[1.2] tracking-[-0.015em] text-foreground sm:text-[24px]">
                    {d.title}
                  </h3>
                  <p className="mt-2.5 text-[15px] leading-[1.6] text-text-2">
                    {d.description}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
