import { ApplicationStatus } from "@prisma/client"
import { Badge } from "@/components/ui/badge"

/**
 * Pill de estado para `TeacherApplication`. Mapeo `enum → variant + label`
 * centralizado para que el listado y futuros lugares (detalle, dashboard)
 * usen la misma traducción.
 */

const STATUS: Record<
  ApplicationStatus,
  { label: string; variant: "teal" | "warning" | "danger" }
> = {
  PENDING: { label: "Pendiente", variant: "warning" },
  APPROVED: { label: "Aprobada", variant: "teal" },
  REJECTED: { label: "Rechazada", variant: "danger" },
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const cfg = STATUS[status]
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
