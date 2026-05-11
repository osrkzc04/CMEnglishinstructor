"use server"

import { cookies } from "next/headers"
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config"

/**
 * Lee el locale activo desde la cookie. Devuelve `defaultLocale` si la cookie
 * no existe o tiene un valor desconocido.
 *
 * Esta función es server-only — el cliente recibe el locale resuelto vía el
 * `NextIntlClientProvider` que envuelve el árbol React.
 */
export async function getUserLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : defaultLocale
}

/**
 * Server action invocada desde el dropdown ES/EN. Persiste la elección por
 * un año y delega el re-render al `router.refresh()` del cliente.
 *
 * No redirige ni revalida rutas: las server components vuelven a leer la
 * cookie en el siguiente render y `next-intl` resuelve los mensajes nuevos.
 */
export async function setUserLocale(locale: Locale): Promise<void> {
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 año
    sameSite: "lax",
  })
}
