import { Reveal } from "./Reveal"

/**
 * Sección "Programas". Cards editoriales con eyebrow, título, descripción y
 * un listado de programas internos (Time Zones, Life, Market Leader, etc.).
 *
 * Copy curado a nivel marketing — los nombres calzan con el catálogo cargado
 * en `prisma/seed.ts` para no contradecir lo que ofrece la academia, pero el
 * texto de venta es independiente del schema.
 */

const PROGRAMS = [
  {
    eyebrow: "Adultos · adolescentes",
    title: "General English",
    description:
      "Inglés para conversar, viajar y trabajar con confianza. Programa progresivo con materiales internacionales y un docente que te acompaña en cada clase.",
    programs: ["Time Zones", "Life", "Perspectives"],
    cefr: "A1 → C1",
  },
  {
    eyebrow: "Ejecutivos · empresas",
    title: "Business English",
    description:
      "Inglés que sirve para presentar, negociar y reunirte sin que el idioma te frene. Programas completos para tu rol o módulos cortos cuando necesitas algo puntual.",
    programs: ["Market Leader", "Specialization (modular)"],
    cefr: "A2 → C1",
  },
  {
    eyebrow: "Niñas · niños",
    title: "Kids Learning",
    description:
      "Inglés para que aprendan con confianza, no por miedo a equivocarse. Lectura, escritura y conversación con seguimiento cercano para la familia.",
    programs: ["Kids English Integral"],
    cefr: "A1 → A2",
  },
  {
    eyebrow: "Para extranjeros",
    title: "Español como lengua extranjera",
    description:
      "Español para personas que quieren vivir, estudiar o trabajar en Latinoamérica con soltura. Foco en conversación real y vocabulario aplicado al contexto local.",
    programs: ["Vistas 1 → 6"],
    cefr: "A1 → C2",
  },
]

export function MarketingPrograms() {
  return (
    <section
      id="programas"
      className="bg-surface-alt/40 py-20 md:py-24"
    >
      <div className="mx-auto w-full max-w-[1180px] px-6">
        <Reveal as="header" className="mb-12 max-w-[680px]">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-text-3">
            Programas
          </p>
          <h2 className="font-serif text-[36px] leading-[1.12] tracking-[-0.02em] text-foreground sm:text-[44px]">
            Una propuesta editorial para
            <em className="font-light italic text-text-2"> cada audiencia</em>.
          </h2>
          <p className="mt-4 text-[16px] leading-[1.65] text-text-2">
            Cuatro líneas con currículos publicados por editoriales reconocidas
            (National Geographic Learning, Pearson, Vistas). Cada plan se ajusta
            a tu nivel actual, tu objetivo y tu ritmo.
          </p>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-2">
          {PROGRAMS.map((p, i) => (
            <Reveal key={p.title} delay={i * 80}>
              <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface p-6 transition-[border-color,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-teal-500/40 motion-reduce:transition-none motion-reduce:transform-none">
                {/* Acento teal a la izquierda — entra al hacer hover. */}
                <span
                  aria-hidden
                  className="absolute inset-y-6 left-0 w-[2px] origin-top scale-y-0 rounded-r bg-teal-500 transition-transform duration-300 ease-out group-hover:scale-y-100 motion-reduce:transition-none"
                />
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-3">
                  {p.eyebrow}
                </p>
                <h3 className="mt-2 font-serif text-[26px] leading-[1.18] tracking-[-0.015em] text-foreground">
                  {p.title}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.6] text-text-2">
                  {p.description}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-1.5">
                  {p.programs.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-text-2"
                    >
                      {name}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-border pt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
                  <span>Cobertura MCER</span>
                  <span className="text-foreground">{p.cefr}</span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
