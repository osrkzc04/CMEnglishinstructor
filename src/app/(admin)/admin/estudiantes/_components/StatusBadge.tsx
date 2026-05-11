import { UserStatus } from "@prisma/client"
import { Badge } from "@/components/ui/badge"

/**
 * Pill de estado para `User`. Mapeo `enum → variant + label` centralizado
 * para que listado y futuros lugares usen la misma traducción.
 */

const STATUS: Record<
  UserStatus,
  { label: string; variant: "teal" | "warning" | "default" }
> = {
  ACTIVE: { label: "Activo", variant: "teal" },
  PENDING_APPROVAL: { label: "Pendiente", variant: "warning" },
  INACTIVE: { label: "Inactivo", variant: "default" },
}

export function StatusBadge({ status }: { status: UserStatus }) {
  const cfg = STATUS[status]
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
