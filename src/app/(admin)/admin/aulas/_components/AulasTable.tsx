import Link from "next/link"
import type { Route } from "next"
import { ArrowUpRight } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/ui/empty-state"
import { Tag } from "@/components/ui/tag"
import { StatusBadge } from "./StatusBadge"
import type { ClassGroupListItem } from "@/modules/classGroups/queries"

const MODALITY_LABEL: Record<string, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrida",
}

export function AulasTable({ items }: { items: ClassGroupListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="border-border bg-surface rounded-xl border">
        <EmptyState
          title="Sin aulas"
          description="Crea la primera aula para empezar a agrupar matrículas con horario y docente."
        />
      </div>
    )
  }

  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <tr>
            <TableHead className="w-[260px]">Aula</TableHead>
            <TableHead>Programa</TableHead>
            <TableHead className="w-[110px]">Modalidad</TableHead>
            <TableHead className="w-[120px]">Docente</TableHead>
            <TableHead className="w-[100px] text-center">Alumnos</TableHead>
            <TableHead className="w-[110px]">Estado</TableHead>
            <TableHead className="w-[80px] text-right">Acción</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="text-foreground font-medium">{row.name}</div>
                <div className="text-text-3 mt-0.5 text-[12.5px]">
                  {row.slotsCount} {row.slotsCount === 1 ? "clase/sem" : "clases/sem"}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-foreground text-[13.5px]">{row.programLabel}</div>
                {row.cefrLevelCode && (
                  <div className="mt-1">
                    <Tag>CEFR {row.cefrLevelCode}</Tag>
                  </div>
                )}
              </TableCell>
              <TableCell>
                <span className="text-text-2 text-[13px]">
                  {MODALITY_LABEL[row.modality] ?? row.modality}
                </span>
              </TableCell>
              <TableCell>
                {row.currentTeacherName ? (
                  <span className="text-foreground text-[13px]">{row.currentTeacherName}</span>
                ) : (
                  <span className="text-warning text-[12.5px]">Sin asignar</span>
                )}
              </TableCell>
              <TableCell className="text-text-2 text-center font-mono text-[13px] tracking-[0.02em]">
                {row.enrollmentsCount}
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/admin/aulas/${row.id}` as Route}
                  aria-label={`Ver aula ${row.name}`}
                  className="border-border bg-surface text-text-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12.5px] transition-colors hover:border-teal-500 hover:text-teal-500"
                >
                  Ver
                  <ArrowUpRight size={12} strokeWidth={1.6} />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
