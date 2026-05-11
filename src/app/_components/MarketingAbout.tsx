import { Reveal } from "./Reveal"

/**
 * Sección "Sobre nosotros". Pieza editorial entre el hero y el bloque
 * de programas — su trabajo es responder "¿quiénes están detrás de esto?"
 * antes de que el visitante entre a evaluar la oferta.
 *
 * Decisiones de composición:
 *   - Layout a una sola columna centrada (~720px). Diferencia el ritmo del
 *     resto de la página, que es card-driven, y deja respirar antes del
 *     bloque denso de Programas.
 *   - Ampersand decorativo en el lateral derecho repite el ancla visual del
 *     hero y del closer — bookends del sistema editorial de la marca.
 *   - Bloque "Dirige" al pie con divider sutil. No carga otra foto de
 *     Carolina (el hero ya tiene la principal); aquí prima la prosa.
 *
 * Decisiones de copy:
 *   - No comprometer fechas, número de estudiantes ni hitos verificables.
 *     Carolina puede ajustar los párrafos sin tocar el layout.
 *   - "Una escuela pequeña con vocación grande" diferencia del segmento
 *     enterprise sin negarlo: somos boutique, atendemos a equipos.
 *   - El último párrafo recapitula audiencias y modalidades — no inventa
 *     nada nuevo, solo lo enmarca en clave humana.
 */
export function MarketingAbout() {
  return (
    <section
      id="nosotros"
      aria-labelledby="about-title"
      className="border-border bg-background relative overflow-hidden border-t py-24 md:py-32"
    >
      {/* Ampersand decorativo — ancla editorial consistente con hero y closer */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 -right-16 -translate-y-1/2 font-serif text-[420px] leading-none text-teal-500/[0.05] italic select-none sm:text-[560px] lg:text-[680px]"
      >
        &amp;
      </span>

      <div className="relative mx-auto w-full max-w-[1180px] px-6">
        <div className="mx-auto max-w-[720px]">
          <Reveal as="header">
            <p className="text-text-3 mb-3 font-mono text-[11px] tracking-[0.1em] uppercase">
              Sobre nosotros
            </p>
            <h2
              id="about-title"
              className="text-foreground font-serif text-[36px] leading-[1.12] tracking-[-0.02em] sm:text-[46px]"
            >
              Una escuela pequeña
              <em className="text-text-2 font-light italic"> con vocación grande</em>.
            </h2>
          </Reveal>

          <Reveal delay={120}>
            <div className="text-text-2 mt-8 space-y-5 text-[17px] leading-[1.7]">
              <p>
                <span className="text-foreground font-medium">CM English Instructor</span> acompaña
                a personas y equipos a comunicarse con seguridad en inglés y español. Trabajamos con
                currículos publicados por editoriales reconocidas, docentes certificados y un
                acompañamiento cercano que prioriza el avance real del estudiante por sobre el ritmo
                del programa.
              </p>
              <p>
                Creemos que aprender un idioma con seriedad no tiene que sentirse frío. Por eso
                combinamos rigor académico con una manera muy humana de enseñar — clases bien
                preparadas, retroalimentación oportuna y una relación directa con quien dirige la
                academia. Sin formularios eternos, sin call centers.
              </p>
              <p>
                Trabajamos con ejecutivos, equipos corporativos, adultos, adolescentes y niños. Cada
                plan se diseña a medida — virtual, presencial o híbrido — y se ajusta a la rutina
                real de quien aprende, no al revés.
              </p>
            </div>
          </Reveal>

          <Reveal delay={220}>
            <div className="border-border mt-12 flex flex-col gap-1 border-t pt-6">
              <p className="text-text-3 font-mono text-[11px] tracking-[0.12em] uppercase">
                Dirige
              </p>
              <p className="text-foreground font-serif text-[20px] leading-[1.3] italic">
                Carolina Monsalve
              </p>
              <p className="text-text-3 font-mono text-[11px] tracking-[0.1em] uppercase">
                Certified English &amp; Spanish Instructor · CELTA Cambridge
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
