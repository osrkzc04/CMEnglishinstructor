import type { Metadata } from "next"
import { Check } from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/layout/BrandMark"
import { getInviteByToken } from "@/modules/tests/sessions/start"

export const metadata: Metadata = { title: "Evaluación finalizada" }

type RouteParams = { token: string }

/**
 * Pantalla genérica de finalización. NO diferencia entre haber completado
 * todas las secciones, haber sido cortado por umbral o haberse acabado el
 * tiempo — el candidato recibe el mismo mensaje en todos los casos. La
 * información de nivel y resultados llega después por correo (revisión).
 */
export default async function FinalizadoPage({ params }: { params: Promise<RouteParams> }) {
  const { token } = await params
  const invite = await getInviteByToken(token)
  const firstName = invite?.candidateName.split(" ")[0] ?? null

  return (
    <main className="bg-background flex min-h-screen flex-col px-4 py-10">
      <header className="mb-10 flex items-center justify-center gap-3">
        <BrandMark className="text-foreground" size={28} />
        <BrandWordmark className="text-foreground" size="md" />
      </header>

      <div className="mx-auto w-full max-w-[480px] flex-1">
        <div className="border-border bg-surface rounded-xl border px-8 py-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-teal-500/[0.1] text-teal-500">
            <Check size={26} strokeWidth={1.8} />
          </span>
          <h1 className="text-foreground mt-5 font-serif text-[26px] leading-[1.2] font-normal tracking-[-0.02em]">
            {firstName ? `Gracias, ${firstName}` : "Gracias"}
          </h1>
          <p className="text-text-2 mt-3 text-[14px] leading-[1.6]">
            Tu evaluación quedó registrada. Coordinación la va a revisar y te llegará el resultado
            por correo en cuanto esté lista.
          </p>
          <p className="text-text-3 mt-4 text-[12.5px] leading-[1.6]">
            Ya puedes cerrar esta ventana.
          </p>
        </div>
      </div>
    </main>
  )
}
