import { BrandMark, BrandWordmark } from "@/components/layout/BrandMark"
import { ShieldAlert } from "lucide-react"

/**
 * Pantalla que aparece cuando el navegador actual no es el que abrió la
 * sesión por primera vez. El candidato debe volver al dispositivo original.
 */
export function DeviceLockedShell() {
  return (
    <main className="bg-background flex min-h-screen flex-col px-4 py-10">
      <header className="mb-10 flex items-center justify-center gap-3">
        <BrandMark className="text-foreground" size={28} />
        <BrandWordmark className="text-foreground" size="md" />
      </header>
      <div className="mx-auto w-full max-w-[480px] flex-1">
        <div className="border-border bg-surface rounded-xl border px-8 py-10 text-center">
          <span className="bg-warning/[0.1] text-warning mx-auto grid h-14 w-14 place-items-center rounded-full">
            <ShieldAlert size={26} strokeWidth={1.6} />
          </span>
          <h1 className="text-foreground mt-5 font-serif text-[24px] leading-[1.2] font-normal tracking-[-0.02em]">
            Esta evaluación está abierta en otro dispositivo
          </h1>
          <p className="text-text-2 mt-3 text-[14px] leading-[1.6]">
            Por seguridad, la evaluación solo se puede rendir desde el navegador donde la iniciaste.
            Vuelve a abrirla allí para continuar.
          </p>
          <p className="text-text-3 mt-4 text-[12.5px] leading-[1.6]">
            Si crees que es un error, escríbele a coordinación para que te ayuden a retomar.
          </p>
        </div>
      </div>
    </main>
  )
}
