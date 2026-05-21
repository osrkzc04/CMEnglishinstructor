import { Badge } from "@/components/ui/badge"
import type { InviteState } from "@/modules/tests/invites/queries"

/**
 * Mapeo del estado derivado de la invitación a una pill visual. Los nombres
 * son los que ve coordinación — no se exponen los enums internos de Prisma
 * para que la copy se pueda evolucionar sin tocar el dominio.
 */

const STATE: Record<
  InviteState,
  { label: string; variant: "default" | "teal" | "warning" | "danger" | "info" }
> = {
  PENDING: { label: "Por entregar", variant: "info" },
  IN_PROGRESS: { label: "En curso", variant: "teal" },
  SUBMITTED: { label: "Por revisar", variant: "warning" },
  TIMED_OUT: { label: "Por revisar · tiempo", variant: "warning" },
  REVIEWED: { label: "Revisada", variant: "teal" },
  EXPIRED: { label: "Vencida", variant: "default" },
}

export function InviteStateBadge({ state }: { state: InviteState }) {
  const cfg = STATE[state]
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
