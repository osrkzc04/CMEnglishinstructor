import { getRequestConfig } from "next-intl/server"
import { getUserLocale } from "./locale"

/**
 * Punto de entrada que usa `next-intl` para resolver los mensajes y el
 * locale en cada request server-side. Configurado en `next.config.ts` vía
 * `createNextIntlPlugin("./src/i18n/request.ts")`.
 *
 * Carga dinámica con `import()` para que cada locale viaje en su propio
 * chunk: el bundle de un usuario en español no carga el JSON inglés.
 */
export default getRequestConfig(async () => {
  const locale = await getUserLocale()
  const messages = (await import(`../../messages/${locale}.json`)).default
  return { locale, messages }
})
