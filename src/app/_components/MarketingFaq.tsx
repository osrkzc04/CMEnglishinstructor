import { Plus, ArrowUpRight } from "lucide-react"
import { Reveal } from "./Reveal"

/**
 * Sección "Preguntas frecuentes". Acordeón nativo basado en `<details>` /
 * `<summary>` — accesible por default, sin estado de React. Animamos solo
 * el icono Plus → 45deg al abrir vía la variante `group-open:` de Tailwind.
 *
 * El contenido del panel sí se muestra/oculta de forma instantánea (HTML
 * nativo). Una transición suave del alto requeriría animar
 * `grid-template-rows` con un wrapper extra, y a este nivel de copy la
 * inmediatez se siente más limpia que un easing lento.
 *
 * Cierre: micro-CTA al pie con link a `#contacto` para la persona que
 * llegó hasta acá con una duda específica que no encontró respondida.
 */
const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: "¿En qué idiomas enseñan?",
    a: "Trabajamos con inglés y español, cubriendo todos los niveles del Marco Común Europeo de Referencia (MCER), del A1 al C2. Cada idioma cuenta con currículos publicados internacionalmente y docentes especializados en su enseñanza como lengua extranjera.",
  },
  {
    q: "¿Necesito experiencia previa con el idioma?",
    a: "No es necesario. Recibimos estudiantes desde el nivel inicial (A1), pensado para personas sin contacto previo con el idioma, hasta el avanzado (C2) para quienes buscan perfeccionarse. En el primer contacto identificamos tu punto de partida para armar un plan adecuado a tu nivel real.",
  },
  {
    q: "¿Trabajan con niños y adolescentes?",
    a: "Sí. Tenemos un programa específico para niños y otros pensados para adolescentes y adultos jóvenes. La metodología, los materiales y el tono de cada clase se ajustan a la etapa del estudiante, con foco en construir confianza al usar el idioma desde el primer día.",
  },
  {
    q: "¿Tienen programas para empresas?",
    a: "Sí. Diseñamos programas corporativos a medida según el rol y los objetivos de cada equipo: inglés ejecutivo, comunicación profesional, presentaciones, negociación y reuniones de trabajo. Atendemos a equipos completos, áreas específicas o a ejecutivos de manera individual.",
  },
  {
    q: "¿Las clases son virtuales, presenciales o híbridas?",
    a: "Ofrecemos las tres modalidades. Virtual para máxima flexibilidad y horarios cambiantes; presencial cuando la dinámica grupal o la cercanía suman; híbrido para combinar ambas según la semana. Conversamos al inicio para elegir la que mejor se adapta a tu rutina y a tus objetivos.",
  },
  {
    q: "¿Cómo me inscribo?",
    a: "Empezamos con una conversación corta para entender qué buscas, tu nivel actual y los horarios que tienes disponibles. A partir de ahí preparamos una propuesta a medida con el programa, la modalidad y los detalles del plan, para que decidas con toda la información clara.",
  },
]

export function MarketingFaq() {
  return (
    <section id="preguntas" className="border-border bg-surface-alt/40 border-t py-20 md:py-28">
      <div className="mx-auto w-full max-w-[920px] px-6">
        <Reveal as="header" className="mb-12 max-w-[680px]">
          <p className="text-text-3 mb-3 font-mono text-[11px] tracking-[0.1em] uppercase">
            Preguntas frecuentes
          </p>
          <h2 className="text-foreground font-serif text-[36px] leading-[1.12] tracking-[-0.02em] sm:text-[44px]">
            Lo que solemos resolver
            <em className="text-text-2 font-light italic"> antes de empezar</em>.
          </h2>
        </Reveal>

        <Reveal>
          <ul className="border-border border-y">
            {FAQ_ITEMS.map((item, i) => (
              <li key={item.q} className={i > 0 ? "border-border border-t" : undefined}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
                    <span className="text-foreground font-serif text-[18px] leading-[1.35] tracking-[-0.01em] transition-colors duration-200 group-hover:text-teal-500 sm:text-[20px]">
                      {item.q}
                    </span>
                    <span
                      aria-hidden
                      className="border-border bg-surface text-text-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-300 group-open:rotate-45 group-hover:border-teal-500/50 group-hover:text-teal-500 motion-reduce:transition-none"
                    >
                      <Plus size={14} strokeWidth={1.6} />
                    </span>
                  </summary>
                  <p className="text-text-2 pr-12 pb-6 text-[14.5px] leading-[1.65]">{item.a}</p>
                </details>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal
          delay={120}
          className="text-text-2 mt-10 flex flex-wrap items-center justify-between gap-3 text-[14.5px]"
        >
          <p>¿Tienes una pregunta que no está aquí?</p>
          <a
            href="#contacto"
            className="group text-foreground inline-flex items-center gap-1.5 font-medium transition-colors hover:text-teal-500"
          >
            Escríbenos
            <ArrowUpRight
              size={14}
              strokeWidth={1.6}
              className="transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        </Reveal>
      </div>
    </section>
  )
}
