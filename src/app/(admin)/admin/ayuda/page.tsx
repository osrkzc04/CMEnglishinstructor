import type { Route } from "next"
import type { Metadata } from "next"
import { LifeBuoy } from "lucide-react"
import { UnderConstructionShell } from "@/components/layout/UnderConstructionShell"

export const metadata: Metadata = { title: "Ayuda" }

export default async function AdminAyudaPage() {
  return (
    <UnderConstructionShell
      allowedRoles={["DIRECTOR", "COORDINATOR"]}
      section="Sistema"
      title="Ayuda"
      description="Guías de uso, contacto con soporte y respuestas a las preguntas más frecuentes del panel."
      breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" as Route }]}
      icon={LifeBuoy}
    />
  )
}
