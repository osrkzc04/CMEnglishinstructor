import type { Route } from "next"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Clock, Lock, MonitorSmartphone } from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/layout/BrandMark"
import { getInviteByToken } from "@/modules/tests/sessions/start"
import { StartTestButton } from "./_components/StartTestButton"

export const metadata: Metadata = { title: "Evaluación de ubicación" }

type RouteParams = { token: string }

export default async function PruebaWelcomePage({ params }: { params: Promise<RouteParams> }) {
  const { token } = await params
  const invite = await getInviteByToken(token)

  if (!invite) {
    return (
      <ExpiredCard
        title="Enlace inválido"
        body="No encontramos esta evaluación. Confirma con quien te envió el correo."
      />
    )
  }

  // Si la sesión ya está en estado terminal, mostramos pantalla genérica.
  if (
    invite.session &&
    (invite.session.status === "SUBMITTED" ||
      invite.session.status === "TIMED_OUT" ||
      invite.session.status === "REVIEWED" ||
      invite.session.status === "ABANDONED")
  ) {
    redirect(`/prueba/${token}/finalizado` as Route)
  }

  // Si está en curso, retomar directamente.
  if (invite.session && invite.session.status === "IN_PROGRESS") {
    redirect(`/prueba/${token}/rendir` as Route)
  }

  if (invite.expiresAt < new Date()) {
    return (
      <ExpiredCard
        title="El enlace ya venció"
        body="Pídele a coordinación que te envíe uno nuevo para rendir la evaluación."
      />
    )
  }

  return (
    <main className="bg-background flex min-h-screen flex-col px-4 py-10">
      <header className="mb-10 flex items-center justify-center gap-3">
        <BrandMark className="text-foreground" size={28} />
        <BrandWordmark className="text-foreground" size="md" />
      </header>

      <div className="mx-auto w-full max-w-[520px] flex-1">
        <div className="border-border bg-surface rounded-xl border px-8 py-10">
          <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
            Evaluación de ubicación
          </p>
          <h1 className="text-foreground font-serif text-[28px] leading-[1.18] font-normal tracking-[-0.02em]">
            Hola, {invite.candidateName.split(" ")[0]}
          </h1>
          <p className="text-text-2 mt-3 text-[14px] leading-[1.6]">
            Vas a rendir la evaluación de inglés que nos ayuda a ubicarte en el nivel correcto.
            Cuando estés listo, presiona el botón y empezamos.
          </p>

          <ul className="mt-7 space-y-3 text-[13.5px] leading-[1.55]">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-teal-500/[0.08] text-teal-500">
                <Clock size={14} strokeWidth={1.6} />
              </span>
              <span className="text-text-2">
                <span className="text-foreground font-medium">
                  Tiempo total: {invite.timeLimitMinutes} minutos.
                </span>{" "}
                El reloj empieza cuando das clic en iniciar y corre en continuo.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-teal-500/[0.08] text-teal-500">
                <MonitorSmartphone size={14} strokeWidth={1.6} />
              </span>
              <span className="text-text-2">
                <span className="text-foreground font-medium">Un solo dispositivo.</span> Una vez
                que inicias, no puedes abrir la evaluación en otra computadora o teléfono.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-teal-500/[0.08] text-teal-500">
                <Lock size={14} strokeWidth={1.6} />
              </span>
              <span className="text-text-2">
                <span className="text-foreground font-medium">Conexión estable.</span> Si cierras la
                página por accidente, retomas donde quedaste — el reloj sigue.
              </span>
            </li>
          </ul>

          <div className="mt-9">
            <StartTestButton token={token} />
          </div>
        </div>

        <p className="text-text-3 mt-6 text-center text-[12.5px]">
          Una vez completada la evaluación, coordinación la revisará y te llegará el resultado por
          correo.
        </p>
      </div>
    </main>
  )
}

function ExpiredCard({ title, body }: { title: string; body: string }) {
  return (
    <main className="bg-background flex min-h-screen flex-col px-4 py-10">
      <header className="mb-10 flex items-center justify-center gap-3">
        <BrandMark className="text-foreground" size={28} />
        <BrandWordmark className="text-foreground" size="md" />
      </header>
      <div className="mx-auto w-full max-w-[440px] flex-1">
        <div className="border-border bg-surface rounded-xl border px-8 py-9">
          <h1 className="text-foreground font-serif text-[24px] leading-[1.2] font-normal tracking-[-0.02em]">
            {title}
          </h1>
          <p className="text-text-2 mt-3 text-[13.5px] leading-[1.6]">{body}</p>
        </div>
      </div>
    </main>
  )
}
