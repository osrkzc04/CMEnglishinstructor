import Image from "next/image"
import { ArrowRight, FileText, ClipboardCheck, CalendarRange, BarChart3 } from "lucide-react"
import { Reveal } from "./Reveal"

/**
 * Sección "Para empresas". Layout 2-col sobre un fondo con foto editorial
 * tratada en duotono: a la izquierda el manifiesto editorial; a la derecha
 * una grilla de 4 capacidades. CTA final hacia #contacto con subject
 * prefilled para distinguir leads corporativos.
 *
 * Para reemplazar la foto: cambia `ENTERPRISE_PHOTO_SRC` por la URL final
 * (local en /public/landing/empresas.jpg o externa permitida en
 * next.config.ts). Si se establece en `null` se cae al fondo limpio.
 */
const ENTERPRISE_PHOTO_SRC: string | null =
  "https://images.unsplash.com/photo-1521737852567-6949f3f9f2b5?auto=format&fit=crop&w=2400&q=80"
const CAPABILITIES = [
  {
    icon: FileText,
    title: "Diagnóstico inicial",
    description:
      "Pruebas de ubicación MCER por participante y un brief con objetivos, modalidad y carga horaria sugerida.",
  },
  {
    icon: ClipboardCheck,
    title: "Propuesta a medida",
    description:
      "Currículo, modalidad y duración alineados al rol de cada estudiante (ventas, finanzas, técnico).",
  },
  {
    icon: CalendarRange,
    title: "Logística flexible",
    description:
      "Coordinación de horarios entre múltiples participantes, sustitución de docente y reposición de horas.",
  },
  {
    icon: BarChart3,
    title: "Reportes ejecutivos",
    description:
      "Resumen mensual de avance por estudiante para RRHH: asistencia, horas consumidas y bitácoras docentes.",
  },
]

export function MarketingEnterprise() {
  return (
    <section
      id="empresas"
      className="border-border bg-surface-alt/40 relative overflow-hidden border-y py-20 md:py-28"
    >
      <EnterpriseBackdrop />

      <div className="relative mx-auto grid w-full max-w-[1180px] gap-14 px-6 lg:grid-cols-[1fr_1.1fr]">
        <Reveal>
          <p className="text-text-3 mb-3 font-mono text-[11px] tracking-[0.1em] uppercase">
            Para empresas
          </p>
          <h2 className="text-foreground font-serif text-[36px] leading-[1.12] tracking-[-0.02em] sm:text-[44px]">
            Programas corporativos
            <em className="text-text-2 font-light italic"> sin fricción</em>.
          </h2>
          <p className="text-text-2 mt-5 max-w-[480px] text-[16px] leading-[1.65]">
            Trabajamos con bancos, consultoras, tecnológicas y equipos de operaciones. Diseñamos un
            plan de inglés ejecutivo alineado al negocio, con visibilidad continua para RRHH y
            facturación corporativa.
          </p>

          <a
            href="mailto:hola@​cmenglishinstructor.com?subject=Propuesta%20corporativa"
            className="group bg-ink-900 text-bone dark:bg-bone dark:text-ink-900 dark:hover:text-bone mt-8 inline-flex items-center gap-2 rounded-md px-5 py-3 text-[14px] font-medium transition-colors hover:bg-teal-500 dark:hover:bg-teal-500"
          >
            Solicitar propuesta
            <ArrowRight
              size={15}
              strokeWidth={1.6}
              className="transition-transform duration-200 ease-out group-hover:translate-x-0.5"
            />
          </a>
        </Reveal>

        <div className="grid gap-3 sm:grid-cols-2">
          {CAPABILITIES.map((c, i) => (
            <Reveal key={c.title} delay={i * 70}>
              <article className="group border-border bg-surface/95 flex h-full flex-col rounded-xl border p-5 backdrop-blur-sm transition-[border-color,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-teal-500/40 motion-reduce:transform-none motion-reduce:transition-none">
                <div className="border-border bg-background text-foreground mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-200 group-hover:border-teal-500/40 group-hover:text-teal-500 motion-reduce:transition-none">
                  <c.icon size={16} strokeWidth={1.6} />
                </div>
                <h3 className="text-foreground text-[15.5px] font-medium">{c.title}</h3>
                <p className="text-text-2 mt-1.5 text-[14px] leading-[1.6]">{c.description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// -----------------------------------------------------------------------------
//  Backdrop
// -----------------------------------------------------------------------------

/**
 * Fondo de la sección Empresas. Foto editorial con tratamiento duotono
 * suave (opacidad baja + grayscale + blend), sumado al tinte de marca
 * teal sobre todo. La densidad aquí es menor que en el hero porque las
 * capability cards ya cargan visualmente.
 */
function EnterpriseBackdrop() {
  if (!ENTERPRISE_PHOTO_SRC) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={ENTERPRISE_PHOTO_SRC}
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-[0.18] mix-blend-multiply [filter:grayscale(0.85)_contrast(1.05)] dark:opacity-[0.12] dark:mix-blend-screen"
        />
        <div className="absolute inset-0 bg-teal-500/[0.03] mix-blend-multiply dark:bg-teal-500/[0.05] dark:mix-blend-screen" />
        {/* Soft fades arriba y abajo para que la foto no compita con la
         * frontera de la sección anterior/siguiente. */}
        <div className="from-surface-alt absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent" />
        <div className="from-surface-alt absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t to-transparent" />
      </div>
    </div>
  )
}
