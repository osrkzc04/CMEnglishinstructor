import type { Metadata } from "next"
import { Fraunces, Geist, Geist_Mono } from "next/font/google"
import { Suspense } from "react"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { AuthProvider } from "@/components/providers/AuthProvider"
import { ThemeProvider } from "@/components/theme/ThemeProvider"
import { ThemeScript } from "@/components/theme/ThemeScript"
import { NavProgress } from "@/components/layout/NavProgress"
import { cn } from "@/lib/utils"
import "./globals.css"

/**
 * Stack tipográfico — fuente de verdad: design-mockups/*.html.
 *
 * Fraunces: variable axis opsz (9..144), pesos 300/400/500 normal e italic 300/400.
 *   - Display y h1-h4 a peso 400 (mockup baseline).
 *   - Italic 300 para la quote larga del aside del login.
 *   - Italic 400 para `.here` del breadcrumb y `<em>` decorativos.
 * Geist: pesos 300/400/500. 400 baseline, 500 para CTAs y énfasis.
 * Geist Mono: 400/500. tnum activado por default en .font-mono.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
  style: ["normal", "italic"],
})

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
  weight: ["300", "400", "500"],
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  title: {
    default: "CM English Instructor",
    template: "%s · CM English Instructor",
  },
  description:
    "Plataforma académica de CM English Instructor. Inglés y español para empresas, ejecutivos, adolescentes y niños. Helping everyone communicate.",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Locale + messages se resuelven server-side desde la cookie NEXT_LOCALE
  // (ver src/i18n/request.ts). Pasarlos al provider es lo que permite que
  // las client components puedan usar useTranslations() sin re-fetch.
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className={cn(
          fraunces.variable,
          geistSans.variable,
          geistMono.variable,
          "bg-background text-foreground font-sans antialiased",
        )}
      >
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
