import { Card, CardHeader, CardTitle, CardMeta } from "@/components/ui/card"
import { Tag } from "@/components/ui/tag"
import { ProgressBar } from "@/components/ui/progress-bar"

/**
 * Distribución por nivel — design-mockups/Dashboard.html:1241-1280.
 *
 * Filas con head (name + tag CEFR + numéricos) y bar abajo. Variantes:
 *   info     básico
 *   default  intermedio (teal)
 *   warn     avanzado
 *   danger   sin nivel asignado
 */

export type LevelEntry = {
  id: string
  name: string
  tag?: string
  count: number
  total: number
  variant: "info" | "default" | "warn" | "danger"
}

export function LevelsCard({ items, meta }: { items: LevelEntry[]; meta: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribución por nivel</CardTitle>
        <CardMeta>{meta}</CardMeta>
      </CardHeader>
      <div className="px-[22px] py-2">
        {items.map((row) => (
          <LevelRow key={row.id} row={row} />
        ))}
      </div>
    </Card>
  )
}

function LevelRow({ row }: { row: LevelEntry }) {
  const pct = Math.round((row.count / row.total) * 100)
  return (
    <div className="border-border border-b border-dashed py-3 last:border-b-0">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-foreground text-[13.5px]">
          {row.name}
          {row.tag && (
            <Tag className="ml-1.5 align-baseline" style={{ fontSize: 11 }}>
              {row.tag}
            </Tag>
          )}
        </div>
        <div className="text-foreground font-mono text-[12.5px] tabular-nums">
          {row.count} <span className="text-text-3">/ {row.total}</span> · {pct}%
        </div>
      </div>
      <ProgressBar value={pct} variant={row.variant} bordered />
    </div>
  )
}
