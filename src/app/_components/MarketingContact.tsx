import { Mail, Phone, Clock } from "lucide-react"
import { Reveal } from "./Reveal"
import { ContactForm } from "./ContactForm"

/**
 * Sección "Contacto". Layout 2-col en desktop:
 *   - Izquierda: header editorial + datos de contacto duros (correo,
 *     ubicación, ventana de respuesta).
 *   - Derecha: formulario tradicional con validación cliente y server,
 *     captcha Turnstile y rate-limit por IP/email.
 *
 * Decisiones:
 *   - Las tarjetas mailto (Personas / Empresas / "Reservar conversación")
 *     y la banda de postulación docente fueron retiradas. El form único
 *     simplifica el funnel y la postulación de docentes vivirá en su
 *     propia ruta `/postular-docente` accesible desde el footer.
 *   - `turnstileSiteKey` se lee server-side y se pasa al form; sin la
 *     variable se inyecta token placeholder en el cliente y la action
 *     omite la verificación (pensado para dev local).
 */
export function MarketingContact() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""

  return (
    <section id="contacto" className="py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1180px] px-6">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1fr] lg:gap-20">
          <Reveal as="header">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-text-3">
              Contacto
            </p>
            <h2 className="font-serif text-[36px] leading-[1.12] tracking-[-0.02em] text-foreground sm:text-[44px]">
              Cuéntanos qué buscas y armamos un plan
              <em className="font-light italic text-text-2"> a tu medida</em>.
            </h2>
            <p className="mt-5 max-w-[460px] text-[16px] leading-[1.65] text-text-2">
              Déjanos tu mensaje y te respondemos para coordinar una
              conversación corta. Sin compromiso — la idea es entender qué
              necesitas y mostrarte cómo trabajamos.
            </p>

            <div className="mt-10 grid gap-3">
              <ContactCard
                icon={<Mail size={15} strokeWidth={1.6} />}
                label="Correos"
                entries={[
                  {
                    value: "cmonsalve@cmenglishinstructor.com",
                    href: "mailto:cmonsalve@cmenglishinstructor.com",
                  },
                  {
                    value: "info@cmenglishinstructor.com",
                    href: "mailto:info@cmenglishinstructor.com",
                  },
                ]}
              />
              <ContactCard
                icon={<Phone size={15} strokeWidth={1.6} />}
                label="Teléfonos"
                entries={[
                  {
                    value: "+593 958 74 70 16",
                    href: "tel:+593958747016",
                  },
                  {
                    value: "+593 992 52 66 19",
                    href: "tel:+593992526619",
                  },
                ]}
              />
              <ContactCard
                icon={<Clock size={15} strokeWidth={1.6} />}
                label="Tiempo de respuesta"
                entries={[{ value: "Menos de 24 horas hábiles" }]}
              />
            </div>
          </Reveal>

          <Reveal delay={120}>
            <ContactForm turnstileSiteKey={turnstileSiteKey} />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function ContactCard({
  icon,
  label,
  entries,
}: {
  icon: React.ReactNode
  label: string
  entries: { value: string; href?: string }[]
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-5 transition-colors duration-200 hover:border-border-strong">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-text-2">
          {icon}
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-4">
          {label}
        </span>
      </div>
      <div className="mt-3 flex min-w-0 flex-col gap-1">
        {entries.map((entry) =>
          entry.href ? (
            <a
              key={entry.value}
              href={entry.href}
              className="truncate text-[14.5px] text-foreground transition-colors hover:text-teal-500"
            >
              {entry.value}
            </a>
          ) : (
            <span
              key={entry.value}
              className="truncate text-[14.5px] text-text-2"
            >
              {entry.value}
            </span>
          ),
        )}
      </div>
    </article>
  )
}
