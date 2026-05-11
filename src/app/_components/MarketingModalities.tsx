import { Video, MapPin, Repeat } from "lucide-react"
import { Reveal } from "./Reveal"

/**
 * Sección "Modalidades". Tres cards horizontales con icono de Lucide,
 * título y descripción corta. El icono va en stroke 1.6 (estándar del
 * sistema), tamaño 18px, sobre un círculo bone-50.
 */
const MODALITIES = [
  {
    icon: Video,
    title: "Virtual",
    description:
      "Clases en vivo desde donde estés, con materiales digitales y la opción de revisar grabaciones cuando lo necesites. Ideal para horarios cambiantes o equipos distribuidos.",
  },
  {
    icon: MapPin,
    title: "Presencial",
    description:
      "Clases cara a cara cuando la dinámica grupal o la cercanía hacen la diferencia. Misma calidad de materiales y seguimiento. Recomendado para grupos consolidados.",
  },
  {
    icon: Repeat,
    title: "Híbrido",
    description:
      "Combinamos sesiones virtuales y presenciales según tu agenda. Útil cuando viajas, cambias de oficina o tienes una semana atípica. Flexibilidad sin perder continuidad.",
  },
]

export function MarketingModalities() {
  return (
    <section id="modalidades" className="py-20 md:py-24">
      <div className="mx-auto w-full max-w-[1180px] px-6">
        <Reveal as="header" className="mb-12 max-w-[680px]">
          <p className="text-text-3 mb-3 font-mono text-[11px] tracking-[0.1em] uppercase">
            Modalidades
          </p>
          <h2 className="text-foreground font-serif text-[36px] leading-[1.12] tracking-[-0.02em] sm:text-[44px]">
            Donde te resulte
            <em className="text-text-2 font-light italic"> más útil</em>.
          </h2>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-3">
          {MODALITIES.map((m, i) => (
            <Reveal key={m.title} delay={i * 100}>
              <article className="group border-border bg-surface flex h-full flex-col rounded-xl border p-6 transition-[border-color,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-teal-500/40 motion-reduce:transform-none motion-reduce:transition-none">
                <div className="border-border bg-background text-foreground mb-5 inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-200 group-hover:border-teal-500/40 group-hover:text-teal-500 motion-reduce:transition-none">
                  <m.icon size={18} strokeWidth={1.6} />
                </div>
                <h3 className="text-foreground font-serif text-[22px] leading-[1.2] tracking-[-0.015em]">
                  {m.title}
                </h3>
                <p className="text-text-2 mt-2.5 text-[14.5px] leading-[1.6]">{m.description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
