import type { Route } from "next"
import type { Metadata } from "next"
import { BarChart3 } from "lucide-react"
import { UnderConstructionShell } from "@/components/layout/UnderConstructionShell"

export const metadata: Metadata = { title: "Reportes" }

export default async function AdminReportesPage() {
  return (
    <UnderConstructionShell
      allowedRoles={["DIRECTOR", "COORDINATOR"]}
      section="Recursos"
      title="Reportes"
      description="Vistas agregadas de matrículas, asistencia, horas dictadas y desempeño. Las preparamos cuando haya datos consolidados."
      breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" as Route }]}
      icon={BarChart3}
    />
  )
}
