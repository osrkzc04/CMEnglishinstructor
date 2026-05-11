import Link from "next/link"
import type { Route } from "next"
import { ArrowUpRight, BookOpen, FolderOpen } from "lucide-react"
import { Card, CardHeader, CardTitle, CardMeta } from "@/components/ui/card"
import { HoursProgress } from "@/components/shared/HoursProgress"
import { Tag } from "@/components/ui/tag"

/**
 * "Mi nivel" — focused card del estudiante. Programa + nivel + barra de horas
 * + acceso a materiales del nivel.
 *
 * Sigue el patrón visual de los cards de bottom-grid del admin (PendingsCard /
 * TeacherLoadCard): título + meta + acción a la derecha.
 */

const MODALITY_LABEL: Record<string, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrida",
}

export type MyLevelEntry = {
  enrollmentId: string
  programName: string
  levelName: string
  modality: string
  consumedHours: number
  totalHours: number
  rootFolderId: string | null
}

export function MyLevelCard({ entries }: { entries: MyLevelEntry[] }) {
  const isPlural = entries.length > 1
  return (
    <Card>
      <CardHeader>
        <CardTitle>{isPlural ? "Mis niveles" : "Mi nivel"}</CardTitle>
        <CardMeta>
          {entries.length} {entries.length === 1 ? "matrícula" : "matrículas"}
        </CardMeta>
      </CardHeader>
      <div>
        {entries.length === 0 ? (
          <p className="text-text-3 px-[22px] py-6 text-[13.5px]">Aún sin matrícula activa.</p>
        ) : (
          entries.map((e) => <LevelRow key={e.enrollmentId} entry={e} />)
        )}
      </div>
    </Card>
  )
}

function LevelRow({ entry }: { entry: MyLevelEntry }) {
  return (
    <div className="border-border border-b px-[22px] py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-text-3 mb-1.5 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] uppercase">
            <BookOpen size={11} strokeWidth={1.6} />
            Programa
          </div>
          <div className="text-foreground font-serif text-[18px] leading-[1.2] font-normal tracking-[-0.01em]">
            {entry.programName}
          </div>
          <div className="text-text-2 mt-0.5 text-[13px]">{entry.levelName}</div>
          <div className="mt-2">
            <Tag>{MODALITY_LABEL[entry.modality] ?? entry.modality}</Tag>
          </div>
        </div>
        {entry.rootFolderId ? (
          <Link
            href={`/estudiante/materiales/${entry.rootFolderId}` as Route}
            className="border-border bg-surface text-text-2 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12.5px] transition-colors hover:border-teal-500 hover:text-teal-500"
          >
            <FolderOpen size={12} strokeWidth={1.6} />
            Materiales
            <ArrowUpRight size={11} strokeWidth={1.6} />
          </Link>
        ) : (
          <span className="text-text-3 text-[12px]">Sin materiales todavía</span>
        )}
      </div>
      <HoursProgress
        label="Tu avance"
        consumed={entry.consumedHours}
        total={entry.totalHours}
        className="mt-3.5"
        size="sm"
      />
    </div>
  )
}
