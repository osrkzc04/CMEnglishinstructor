import type { Metadata } from "next"
import { AuthCardShell } from "@/components/auth/AuthCardShell"
import { peekUserToken } from "@/modules/auth/tokens"
import { SetPasswordForm } from "../../activar/[token]/_components/SetPasswordForm"

export const metadata: Metadata = { title: "Restablecer contraseña" }

type RouteParams = { token: string }

export default async function RecuperarTokenPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { token } = await params
  const peeked = await peekUserToken(token)
  const isValid = peeked && peeked.purpose === "reset"

  if (!isValid) {
    return (
      <AuthCardShell
        title="Enlace inválido"
        subtitle="El enlace expiró o ya fue usado. Solicitá uno nuevo desde la pantalla de inicio de sesión."
      >
        <div />
      </AuthCardShell>
    )
  }

  return (
    <AuthCardShell
      title="Nueva contraseña"
      subtitle="Definí tu nueva contraseña. Mínimo 8 caracteres."
    >
      <SetPasswordForm token={token} variant="reset" />
    </AuthCardShell>
  )
}
