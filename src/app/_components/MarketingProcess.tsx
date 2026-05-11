import { ArrowRight } from "lucide-react"
import { Reveal } from "./Reveal"

/**
 * Sección "Cómo empezamos". Tres pasos del journey desde el primer contacto
 * hasta la primera clase. Reduce la fricción de "no sé cómo arrancar" y
 * concentra a la persona en un próximo paso pequeño y concreto.
 *
 * Visual: cards horizontales con número grande + título + bajada y un
 * connector entre ellas (flecha o línea) para reforzar la idea de flujo.
 */
const STEPS = [
  {
    number: "01",
    title: "Conversamos",
    description:
      "Cuéntanos qué buscas, tu nivel actual y los horarios que tienes disponibles. Sin formularios largos.",
  },
  {
    number: "02",
    title: "Diagnóstico y propuesta",
    description:
      "Aplicamos prueba de ubicación corta, recomendamos programa y modalidad, y enviamos plan + costos sin compromiso.",
  },
  {
    number: "03",
    title: "Empiezas a tu ritmo",
    description:
      "Asignamos docente, agendamos las primeras clases y comienzas. Los ajustes en el camino son parte del proceso.",
  },
]

export function MarketingProcess() {
  return (
    <section id="proceso" className="py-20 md:py-24">
      <div className="mx-auto w-full max-w-[1180px] px-6">
        <Reveal as="header" className="mb-14 max-w-[680px]">
          <p className="text-text-3 mb-3 font-mono text-[11px] tracking-[0.1em] uppercase">
            Cómo empezamos
          </p>
          <h2 className="text-foreground font-serif text-[36px] leading-[1.12] tracking-[-0.02em] sm:text-[44px]">
            Tres pasos
            <em className="text-text-2 font-light italic"> hasta tu primera clase</em>.
          </h2>
        </Reveal>

        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.number} delay={i * 100} as="div">
              <li className="group border-border bg-surface relative flex h-full flex-col rounded-xl border p-6 transition-[border-color,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-teal-500/40 motion-reduce:transform-none motion-reduce:transition-none">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-text-3 font-mono text-[11px] tracking-[0.12em] uppercase">
                    Paso
                  </span>
                  <span className="text-text-3 font-serif text-[36px] leading-none font-light tracking-[-0.02em] transition-colors duration-300 group-hover:text-teal-500">
                    {step.number}
                  </span>
                </div>
                <h3 className="text-foreground font-serif text-[22px] leading-[1.2] tracking-[-0.015em]">
                  {step.title}
                </h3>
                <p className="text-text-2 mt-2.5 text-[14.5px] leading-[1.6]">{step.description}</p>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={320} className="mt-10 flex justify-center">
          <a
            href="#contacto"
            className="group bg-ink-900 text-bone dark:bg-bone dark:text-ink-900 dark:hover:text-bone inline-flex items-center gap-2 rounded-md px-6 py-3.5 text-[14px] font-medium transition-colors hover:bg-teal-500 dark:hover:bg-teal-500"
          >
            Reservar una conversación
            <ArrowRight
              size={15}
              strokeWidth={1.6}
              className="transition-transform duration-200 ease-out group-hover:translate-x-0.5"
            />
          </a>
        </Reveal>
      </div>
    </section>
  )
}
