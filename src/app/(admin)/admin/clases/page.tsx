import type { Route } from "next"
import type { Metadata } from "next"
import { CalendarDays } from "lucide-react"
import { UnderConstructionShell } from "@/components/layout/UnderConstructionShell"

export const metadata: Metadata = { title: "Clases" }

export default async function AdminClasesPage() {
  return (
    <UnderConstructionShell
      allowedRoles={["DIRECTOR", "COORDINATOR"]}
      section="Operación"
      title="Clases"
      description="El calendario y el detalle de cada sesión van a vivir acá. Por ahora se gestiona desde el aula."
      breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" as Route }]}
      icon={CalendarDays}
    />
  )
}
