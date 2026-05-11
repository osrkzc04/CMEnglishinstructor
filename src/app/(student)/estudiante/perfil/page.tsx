import type { Route } from "next"
import type { Metadata } from "next"
import { UserCircle } from "lucide-react"
import { UnderConstructionShell } from "@/components/layout/UnderConstructionShell"

export const metadata: Metadata = { title: "Mi perfil" }

export default async function StudentPerfilPage() {
  return (
    <UnderConstructionShell
      allowedRoles={["STUDENT"]}
      section="Cuenta"
      title="Mi perfil"
      description="Tus datos personales, contacto, empresa y contraseña. Se libera con el módulo de cuenta."
      breadcrumbs={[{ label: "Estudiante", href: "/estudiante/dashboard" as Route }]}
      icon={UserCircle}
    />
  )
}
