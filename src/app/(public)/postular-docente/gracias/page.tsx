import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { BrandMark } from "@/components/layout/BrandMark"

export const metadata: Metadata = {
  title: "Postulación enviada — CM English Instructor",
  robots: { index: false, follow: false },
}

export default function GraciasPage() {
  return (
    <div className="min-h-screen bg-bone">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" aria-label="Inicio" className="block">
            <BrandMark />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-20 lg:py-28">
        <div className="rounded-xl border border-border bg-surface p-10 text-center lg:p-14">
          <div className="mx-auto mb-6 inline-flex items-center justify-center rounded-full bg-teal-500/10 p-3 text-teal-500">
            <CheckCircle2 size={36} strokeWidth={1.6} />
          </div>
          <h1 className="font-serif text-[30px] font-normal leading-tight tracking-[-0.015em] text-foreground">
            Recibimos tu postulación
          </h1>
          <p className="mt-3 text-[15px] leading-[1.6] text-text-2">
            Te enviamos una confirmación a tu correo. Vamos a revisar tu
            perfil con calma y, si encaja con lo que buscamos, te escribimos
            para coordinar una entrevista.
          </p>
          <p className="mt-2 text-[14px] leading-[1.6] text-text-3">
            El proceso suele tomarnos entre 5 y 10 días hábiles.
          </p>
          <div className="mt-8">
            <Link
              href="/"
              className="text-[13.5px] text-teal-500 underline-offset-4 transition-colors hover:underline"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
