/**
 * Configuración central de i18n para el landing.
 *
 * Por ahora solo el landing está internacionalizado. El producto interno
 * (admin, docente, estudiante) sigue en español hasta que haya un caso
 * concreto que pida traducirlo.
 *
 * La estrategia es **sin URL routing**: el locale activo vive en una cookie
 * (`NEXT_LOCALE`) y no aparece en la ruta. Razones:
 *   - El landing es de un solo archivo de rutas; agregar el segmento `/[locale]/`
 *     forzaría re-arquitectura del resto del producto.
 *   - SEO: los buscadores no necesitan ver `/en/...` distinto de `/es/...` en
 *     este momento — el target principal sigue siendo Ecuador. Si más adelante
 *     queremos dual-language SEO migramos a routing.
 */

export const locales = ["es", "en"] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "es"

export const LOCALE_COOKIE = "NEXT_LOCALE"

export const localeLabels: Record<Locale, string> = {
  es: "Español",
  en: "English",
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value)
}
