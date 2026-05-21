import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { stripMarkdown } from "@/components/ui/rich-prompt"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { QuestionListItem } from "@/modules/questions/queries"
import { QuestionRowActions } from "./QuestionRowActions"

/**
 * Tabla del banco de preguntas.
 *
 * `hideLevelColumn`: cuando estamos en la vista por nivel, la columna nivel
 * es ruido (todas son del mismo). La ocultamos.
 *
 * Las acciones (editar / desactivar) viven en `QuestionRowActions` (cliente)
 * para que la tabla padre pueda quedarse como server component.
 */
export function PreguntasTable({
  items,
  hideLevelColumn,
}: {
  items: QuestionListItem[]
  hideLevelColumn?: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="border-border bg-surface rounded-xl border">
        <EmptyState
          title="Sin preguntas"
          description="No hay preguntas que coincidan con los filtros. Crea una nueva o ajusta los filtros."
        />
      </div>
    )
  }

  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <tr>
            {!hideLevelColumn && <TableHead className="w-[68px]">Nivel</TableHead>}
            <TableHead className="w-[120px]">Tipo</TableHead>
            <TableHead>Enunciado</TableHead>
            <TableHead className="w-[140px]">Tópico</TableHead>
            <TableHead className="w-[100px]">Estado</TableHead>
            <TableHead className="w-[80px] text-right">Usada</TableHead>
            <TableHead className="w-[110px] text-right">Acciones</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {items.map((q) => (
            <TableRow key={q.id}>
              {!hideLevelColumn && (
                <TableCell>
                  <Badge variant="default">{q.level.code}</Badge>
                </TableCell>
              )}
              <TableCell className="text-text-2 text-[13px]">
                {q.type === "MULTIPLE_CHOICE" ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span>Opción múltiple</span>
                    <span className="text-text-3 font-mono text-[11px]">
                      · {q.optionsCount} opc
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span>Completar</span>
                    <span className="text-text-3 font-mono text-[11px]">
                      · {q.acceptedAnswersCount} ans
                    </span>
                  </span>
                )}
              </TableCell>
              <TableCell>
                <p
                  className={cn(
                    "text-foreground line-clamp-2 max-w-[520px] text-[13.5px] leading-[1.5]",
                  )}
                >
                  {stripMarkdown(q.prompt)}
                </p>
              </TableCell>
              <TableCell>
                {q.topic ? (
                  <span className="text-text-2 font-mono text-[12px]">{q.topic}</span>
                ) : (
                  <span className="text-text-4 text-[12px] italic">—</span>
                )}
              </TableCell>
              <TableCell>
                {q.isActive ? (
                  <Badge variant="teal">Activa</Badge>
                ) : (
                  <Badge variant="default">Inactiva</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {q.hasBeenUsed ? (
                  <span className="text-text-3 font-mono text-[11.5px] tracking-[0.02em]">Sí</span>
                ) : (
                  <span className="text-text-4 font-mono text-[11.5px] tracking-[0.02em]">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <QuestionRowActions
                  questionId={q.id}
                  levelCode={q.level.code}
                  prompt={q.prompt}
                  isActive={q.isActive}
                  hasBeenUsed={q.hasBeenUsed}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
