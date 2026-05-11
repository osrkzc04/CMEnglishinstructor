import type { Route } from "next"
import type { Metadata } from "next"
import { Wallet } from "lucide-react"
import { UnderConstructionShell } from "@/components/layout/UnderConstructionShell"

export const metadata: Metadata = { title: "Mis horas" }

export default async function TeacherHorasPage() {
  return (
    <UnderConstructionShell
      allowedRoles={["TEACHER"]}
      section="Mi cuenta"
      title="Mis horas"
      description="Las horas dictadas, las pendientes de facturar y los períodos cerrados. Se libera con el módulo de facturación."
      breadcrumbs={[{ label: "Docente", href: "/docente/dashboard" as Route }]}
      icon={Wallet}
    />
  )
}
