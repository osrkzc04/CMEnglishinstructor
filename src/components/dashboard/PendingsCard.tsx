import Link from "next/link"
import type { Route } from "next"
import { ArrowRight, ChevronRight } from "lucide-react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

/**
 * Postulaciones por revisar — design-mockups/Dashboard.html:1143-1190.
 *
 * Grid 4-col: avatar 32 · info · pill estado · chevron. Estados:
 *  - new      → teal tinted "Nueva"
 *  - review   → warning tinted "En revisión"
 *  - test     → info tinted "Prueba enviada"
 */

export type PendingStatus = "new" | "review" | "test"

export type Pending = {
  id: string
  initials: string
  name: string
  detail: string
  status: PendingStatus
  href: string
}

const STATUS_LABEL: Record<PendingStatus, string> = {
  new: "Nueva",
  review: "En revisión",
  test: "Prueba enviada",
}

export function PendingsCard({ items }: { items: Pending[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Postulaciones por revisar</CardTitle>
        <Link
          href={"/admin/postulaciones" as Route}
          className="border-border-strong text-text-2 inline-flex items-center gap-1.5 border-b pb-px text-[13px] transition-colors hover:border-teal-500 hover:text-teal-500"
        >
          Ir a postulaciones
          <ArrowRight size={11} strokeWidth={1.6} />
        </Link>
      </CardHeader>
      <div>
        {items.map((p) => (
          <PendingRow key={p.id} item={p} />
        ))}
      </div>
    </Card>
  )
}

function PendingRow({ item }: { item: Pending }) {
  return (
    <Link
      href={item.href as Route}
      className="border-border hover:bg-surface-alt grid grid-cols-[32px_1fr_auto_auto] items-center gap-3.5 border-b px-[22px] py-3.5 transition-colors duration-[120ms] last:border-b-0"
    >
      <Avatar initials={item.initials} size="md" className="!h-8 !w-8" />
      <div>
        <div className="text-foreground text-[14px] leading-[1.3]">{item.name}</div>
        <div className="text-text-3 mt-0.5 font-mono text-[12px] tracking-[0.02em]">
          {item.detail}
        </div>
      </div>
      <StatusPill status={item.status} />
      <span className="text-text-4 transition-colors group-hover:text-teal-500">
        <ChevronRight size={14} strokeWidth={1.6} />
      </span>
    </Link>
  )
}

function StatusPill({ status }: { status: PendingStatus }) {
  return (
    <span
      className={cn(
        "rounded-sm border px-2 py-[3px] font-mono text-[11px] leading-[1.4] tracking-[0.06em] uppercase",
        status === "new" && "border-teal-500/35 bg-teal-500/[0.07] text-teal-500",
        status === "review" && "border-warning/35 bg-warning/[0.07] text-warning",
        status === "test" && "border-info/35 bg-info/[0.07] text-info",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
