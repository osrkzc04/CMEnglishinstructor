import { Card, CardHeader, CardTitle, CardMeta } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { ProgressBar } from "@/components/ui/progress-bar"

/**
 * Carga por docente — design-mockups/Dashboard.html:1192-1237.
 *
 * Grid 4-col: avatar · info · util (bar 80px) · load (mono right-aligned).
 * El color del bar refleja la zona de utilización:
 *   warn  ≥85% (sobre carga)
 *   default 60-85% (saludable)
 *   info  <60% (subutilizado)
 */

export type TeacherLoad = {
  id: string
  initials: string
  name: string
  level: string
  hours: number
  capacity: number
}

export function TeacherLoadCard({ items, meta }: { items: TeacherLoad[]; meta: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Carga por docente</CardTitle>
        <CardMeta>{meta}</CardMeta>
      </CardHeader>
      <div>
        {items.map((t) => (
          <TeacherRow key={t.id} item={t} />
        ))}
      </div>
    </Card>
  )
}

function TeacherRow({ item }: { item: TeacherLoad }) {
  const pct = Math.round((item.hours / item.capacity) * 100)
  const variant = pct >= 85 ? "warn" : pct < 60 ? "info" : "default"

  return (
    <div className="border-border grid grid-cols-[32px_1fr_auto_auto] items-center gap-3.5 border-b px-[22px] py-3.5 last:border-b-0">
      <Avatar initials={item.initials} size="md" className="!h-8 !w-8" />
      <div>
        <div className="text-foreground text-[14px] leading-[1.3]">{item.name}</div>
        <div className="text-text-3 mt-0.5 font-mono text-[12px] tracking-[0.02em]">
          {item.level}
        </div>
      </div>
      <div className="w-20">
        <ProgressBar value={pct} variant={variant} bordered />
      </div>
      <div className="text-foreground min-w-[90px] text-right font-mono text-[12px] leading-[1.3] tabular-nums">
        {item.hours} / {item.capacity}
        <div className="text-text-3 mt-0.5 text-[11px]">hrs sem</div>
      </div>
    </div>
  )
}
