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
      <div className="rounded-xl border border-border bg-surface">
        <EmptyState
          title="Sin aulas"
          description="Crea la primera aula para empezar a agrupar matrículas con horario y docente."
        />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
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
                <div className="font-medium text-foreground">{row.name}</div>
                <div className="mt-0.5 text-[12.5px] text-text-3">
                  {row.slotsCount}{" "}
                  {row.slotsCount === 1 ? "clase/sem" : "clases/sem"}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-[13.5px] text-foreground">
                  {row.programLabel}
                </div>
                {row.cefrLevelCode && (
                  <div className="mt-1">
                    <Tag>CEFR {row.cefrLevelCode}</Tag>
                  </div>
                )}
              </TableCell>
              <TableCell>
                <span className="text-[13px] text-text-2">
                  {MODALITY_LABEL[row.modality] ?? row.modality}
                </span>
              </TableCell>
              <TableCell>
                {row.currentTeacherName ? (
                  <span className="text-[13px] text-foreground">
                    {row.currentTeacherName}
                  </span>
                ) : (
                  <span className="text-[12.5px] text-warning">Sin asignar</span>
                )}
              </TableCell>
              <TableCell className="text-center font-mono text-[13px] tracking-[0.02em] text-text-2">
                {row.enrollmentsCount}
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/admin/aulas/${row.id}` as Route}
                  aria-label={`Ver aula ${row.name}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12.5px] text-text-2 transition-colors hover:border-teal-500 hover:text-teal-500"
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
