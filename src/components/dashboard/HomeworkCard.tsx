import Link from "next/link"
import type { Route } from "next"
import { ArrowRight, NotebookPen } from "lucide-react"
import { Card, CardHeader, CardTitle, CardMeta } from "@/components/ui/card"

/**
 * "Tareas recientes" — bitácoras con homework de las últimas sesiones cerradas.
 * Layout consistente con PendingsCard del admin pero sin chevron — son items
 * informativos, no accionables desde el dashboard.
 */

export type HomeworkEntry = {
  sessionId: string
  scheduledStart: Date
  classGroupId: string
  classGroupName: string
  topic: string
  homework: string
}

export function HomeworkCard({ entries }: { entries: HomeworkEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tareas recientes</CardTitle>
        <CardMeta>
          {entries.length} {entries.length === 1 ? "entrega" : "entregas"}
        </CardMeta>
        <Link
          href={"/estudiante/clases" as Route}
          className="border-border-strong text-text-2 inline-flex items-center gap-1.5 border-b pb-px text-[13px] transition-colors hover:border-teal-500 hover:text-teal-500"
        >
          Ver clases
          <ArrowRight size={11} strokeWidth={1.6} />
        </Link>
      </CardHeader>
      <div>
        {entries.length === 0 ? (
          <p className="text-text-3 px-[22px] py-6 text-[13.5px]">
            Cuando el docente publique tareas en la bitácora vas a verlas acá.
          </p>
        ) : (
          entries.map((e) => <HomeworkRow key={e.sessionId} entry={e} />)
        )}
      </div>
    </Card>
  )
}

function HomeworkRow({ entry }: { entry: HomeworkEntry }) {
  return (
    <div className="border-border grid grid-cols-[28px_1fr_auto] items-start gap-3.5 border-b px-[22px] py-3.5 last:border-b-0">
      <div className="grid h-7 w-7 place-items-center rounded-md border border-teal-500/30 bg-teal-500/[0.07] text-teal-500">
        <NotebookPen size={13} strokeWidth={1.6} />
      </div>
      <div className="min-w-0">
        <div className="text-foreground text-[14px] leading-[1.3]">
          <span className="font-medium">{entry.topic}</span>
        </div>
        <p className="text-text-2 mt-0.5 line-clamp-2 text-[12.5px] leading-[1.5]">
          {entry.homework}
        </p>
        <div className="text-text-3 mt-1 font-mono text-[11.5px] tracking-[0.02em]">
          {entry.classGroupName} · {formatDateLong(entry.scheduledStart)}
        </div>
      </div>
    </div>
  )
}

const dateLongFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Guayaquil",
})

function formatDateLong(d: Date): string {
  return dateLongFormatter.format(d).replace(/\./g, "")
}
