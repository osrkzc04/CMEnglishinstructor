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
          <p className="px-[22px] py-6 text-[13.5px] text-text-3">
            Aún sin matrícula activa.
          </p>
        ) : (
          entries.map((e) => <LevelRow key={e.enrollmentId} entry={e} />)
        )}
      </div>
    </Card>
  )
}

function LevelRow({ entry }: { entry: MyLevelEntry }) {
  return (
    <div className="border-b border-border px-[22px] py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
            <BookOpen size={11} strokeWidth={1.6} />
            Programa
          </div>
          <div className="font-serif text-[18px] font-normal leading-[1.2] tracking-[-0.01em] text-foreground">
            {entry.programName}
          </div>
          <div className="mt-0.5 text-[13px] text-text-2">{entry.levelName}</div>
          <div className="mt-2">
            <Tag>{MODALITY_LABEL[entry.modality] ?? entry.modality}</Tag>
          </div>
        </div>
        {entry.rootFolderId ? (
          <Link
            href={`/estudiante/materiales/${entry.rootFolderId}` as Route}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12.5px] text-text-2 transition-colors hover:border-teal-500 hover:text-teal-500"
          >
            <FolderOpen size={12} strokeWidth={1.6} />
            Materiales
            <ArrowUpRight size={11} strokeWidth={1.6} />
          </Link>
        ) : (
          <span className="text-[12px] text-text-3">
            Sin materiales todavía
          </span>
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
