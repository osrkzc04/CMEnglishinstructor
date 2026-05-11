import type { Route } from "next"
import type { Metadata } from "next"
import { UserCircle } from "lucide-react"
import { UnderConstructionShell } from "@/components/layout/UnderConstructionShell"

export const metadata: Metadata = { title: "Mi perfil" }

export default async function TeacherPerfilPage() {
  return (
    <UnderConstructionShell
      allowedRoles={["TEACHER"]}
      section="Mi cuenta"
      title="Mi perfil"
      description="Tus datos personales, biografía pública y contraseña. Lo abrimos cuando se libere la edición."
      breadcrumbs={[{ label: "Docente", href: "/docente/dashboard" as Route }]}
      icon={UserCircle}
    />
  )
}
