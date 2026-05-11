import type { Route } from "next"
import type { Metadata } from "next"
import { ClipboardCheck } from "lucide-react"
import { UnderConstructionShell } from "@/components/layout/UnderConstructionShell"

export const metadata: Metadata = { title: "Pruebas" }

export default async function AdminPruebasPage() {
  return (
    <UnderConstructionShell
      allowedRoles={["DIRECTOR", "COORDINATOR"]}
      section="Operación"
      title="Pruebas"
      description="Banco de preguntas, plantillas e invitaciones de prueba de ubicación. Lo liberamos en el módulo de exámenes."
      breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" as Route }]}
      icon={ClipboardCheck}
    />
  )
}
