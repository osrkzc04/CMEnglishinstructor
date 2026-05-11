import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/modules/auth/queries"
import { dashboardPathFor } from "@/modules/auth/role-paths"
import { MarketingNav } from "./_components/MarketingNav"
import { MarketingHero } from "./_components/MarketingHero"
import { MarketingAbout } from "./_components/MarketingAbout"
import { MarketingPrograms } from "./_components/MarketingPrograms"
import { MarketingModalities } from "./_components/MarketingModalities"
import { MarketingDifferentiators } from "./_components/MarketingDifferentiators"
import { MarketingProcess } from "./_components/MarketingProcess"
import { MarketingFaq } from "./_components/MarketingFaq"
import { MarketingContact } from "./_components/MarketingContact"
import { MarketingTeacherCta } from "./_components/MarketingTeacherCta"
import { MarketingFooter } from "./_components/MarketingFooter"

export const metadata: Metadata = {
  title: "CM English Instructor — Inglés y español con propósito",
  description:
    "Academia dirigida por Carolina Monsalve, Certified English & Spanish Instructor. Programas a medida para ejecutivos, empresas, adultos, adolescentes y niños. Modalidad virtual, presencial e híbrida.",
}

/**
 * Landing pública. Si el usuario ya tiene sesión activa, lo despachamos al
 * dashboard de su rol (mismo comportamiento que /login). Para visitantes,
 * mostramos la página de marketing con la propuesta de valor, programas,
 * modalidades, oferta corporativa y contacto.
 */
export default async function HomePage() {
  const user = await getSessionUser()
  if (user) redirect(dashboardPathFor(user.role))

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketingNav />
      <main>
        <MarketingHero />
        <MarketingAbout />
        <MarketingPrograms />
        <MarketingModalities />
        <MarketingDifferentiators />
        <MarketingProcess />
        <MarketingFaq />
        <MarketingContact />
        <MarketingTeacherCta />
      </main>
      <MarketingFooter />
    </div>
  )
}
