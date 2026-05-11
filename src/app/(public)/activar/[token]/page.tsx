import type { Metadata } from "next"
import { AuthCardShell } from "@/components/auth/AuthCardShell"
import { peekUserToken } from "@/modules/auth/tokens"
import { SetPasswordForm } from "./_components/SetPasswordForm"

export const metadata: Metadata = { title: "Activar cuenta" }

type RouteParams = { token: string }

export default async function ActivarPage({ params }: { params: Promise<RouteParams> }) {
  const { token } = await params
  const peeked = await peekUserToken(token)
  const isValid = peeked && peeked.purpose === "activation"

  if (!isValid) {
    return (
      <AuthCardShell
        title="Enlace inválido"
        subtitle="El enlace expiró o ya fue usado. Pedile a la administración que te envíe uno nuevo."
      >
        <div />
      </AuthCardShell>
    )
  }

  return (
    <AuthCardShell
      title="Activá tu cuenta"
      subtitle="Definí una contraseña para entrar por primera vez. Mínimo 8 caracteres."
    >
      <SetPasswordForm token={token} variant="activation" />
    </AuthCardShell>
  )
}
