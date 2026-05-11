import type { Metadata } from "next"
import { AuthCardShell } from "@/components/auth/AuthCardShell"
import { RequestResetForm } from "./_components/RequestResetForm"

export const metadata: Metadata = { title: "Recuperar contraseña" }

export default function RecuperarPage() {
  return (
    <AuthCardShell
      title="Recuperar contraseña"
      subtitle="Ingresá tu correo y te enviamos un enlace para definir una nueva contraseña."
    >
      <RequestResetForm />
    </AuthCardShell>
  )
}
