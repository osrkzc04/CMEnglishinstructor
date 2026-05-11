import { ClassGroupStatus } from "@prisma/client"
import { Badge } from "@/components/ui/badge"

const STATUS: Record<
  ClassGroupStatus,
  { label: string; variant: "teal" | "default" | "danger" }
> = {
  ACTIVE: { label: "Activa", variant: "teal" },
  COMPLETED: { label: "Cerrada", variant: "default" },
  CANCELLED: { label: "Cancelada", variant: "danger" },
}

export function StatusBadge({ status }: { status: ClassGroupStatus }) {
  const cfg = STATUS[status]
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
