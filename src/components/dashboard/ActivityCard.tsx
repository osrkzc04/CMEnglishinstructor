import Link from "next/link"
import type { Route } from "next"
import type { LucideIcon } from "lucide-react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * Actividad reciente — design-mockups/Dashboard.html:1081-1137.
 *
 * Lista vertical con icon-tile cuadrado tipado por variante (default/teal/warn/
 * danger). Body 13.5px con `<em>` decorativo y links subrayados; when en mono
 * 11.5px.
 */

export type ActivityVariant = "default" | "teal" | "warn" | "danger"

export type ActivityEntry = {
  id: string
  icon: LucideIcon
  variant?: ActivityVariant
  body: React.ReactNode
  when: string
}

export function ActivityCard({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad reciente</CardTitle>
        <Link
          href={"/admin/actividad" as Route}
          className="border-b border-border-strong pb-px text-[13px] text-text-2 transition-colors hover:border-teal-500 hover:text-teal-500"
        >
          Todo
        </Link>
      </CardHeader>
      <div className="px-[22px] py-1.5">
        {entries.map((entry) => (
          <ActivityItem key={entry.id} entry={entry} />
        ))}
      </div>
    </Card>
  )
}

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const Icon = entry.icon
  const variant = entry.variant ?? "default"
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3.5 border-b border-dashed border-border py-3.5 last:border-b-0">
      <div
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-md border text-text-2",
          variant === "default" && "border-border bg-background",
          variant === "teal" && "border-teal-500/30 bg-teal-500/[0.07] text-teal-500",
          variant === "warn" && "border-warning/30 bg-warning/[0.07] text-warning",
          variant === "danger" && "border-danger/30 bg-danger/[0.07] text-danger",
        )}
      >
        <Icon size={14} strokeWidth={1.6} />
      </div>
      <div>
        <div className="text-[13.5px] leading-[1.5] text-foreground [&_em]:font-medium [&_em]:not-italic [&_em]:text-foreground [&_a]:border-b [&_a]:border-border-strong [&_a]:pb-px [&_a]:text-foreground [&_a]:no-underline hover:[&_a]:border-teal-500 hover:[&_a]:text-teal-500">
          {entry.body}
        </div>
        <div className="mt-0.5 font-mono text-[11.5px] tracking-[0.02em] text-text-3">
          {entry.when}
        </div>
      </div>
    </div>
  )
}
