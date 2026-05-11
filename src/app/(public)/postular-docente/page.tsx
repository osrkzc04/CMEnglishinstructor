import type { Metadata } from "next"
import Link from "next/link"
import { listCefrLevelsByLanguage } from "@/modules/teachers/queries"
import { BrandMark } from "@/components/layout/BrandMark"
import { PublicApplicationForm } from "./_components/PublicApplicationForm"

export const metadata: Metadata = {
  title: "Postula como instructor — CM English Instructor",
  description:
    "Si quieres sumarte como instructor de inglés o español en CM English Instructor, completa el formulario y nos pondremos en contacto contigo.",
}

export default async function PostularDocentePage() {
  const levelGroups = await listCefrLevelsByLanguage()
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""

  return (
    <div className="bg-bone min-h-screen">
      <header className="border-border bg-surface border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" aria-label="Inicio" className="block">
            <BrandMark />
          </Link>
          <Link
            href="/login"
            className="text-text-3 hover:text-foreground text-[13px] transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
        <div className="mb-10 max-w-2xl">
          <h1 className="text-foreground font-serif text-[34px] leading-[1.1] font-normal tracking-[-0.015em] lg:text-[40px]">
            Postula como instructor
          </h1>
          <p className="text-text-2 mt-4 text-[15px] leading-[1.6]">
            Si tienes experiencia enseñando inglés o español y quieres sumarte al equipo, completa
            este formulario. Vamos a revisarlo y, si tu perfil coincide con lo que buscamos, te
            escribimos para coordinar una entrevista.
          </p>
        </div>

        <PublicApplicationForm levelGroups={levelGroups} turnstileSiteKey={turnstileSiteKey} />
      </main>
    </div>
  )
}
