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
import type { ApplicationListItem } from "@/modules/teachers/applications/queries"

/**
 * Tabla del listado. Cada fila linkea al detalle, donde viven todas las
 * acciones (aprobar / rechazar / editar / eliminar). Server Component —
 * no necesita estado propio, la navegación es vía `<Link>`.
 */
export function PostulacionesTable({ items }: { items: ApplicationListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface">
        <EmptyState
          title="Sin resultados"
          description="No hay postulaciones que coincidan con los filtros."
        />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <Table>
        <TableHeader>
          <tr>
            <TableHead className="w-[220px]">Postulante</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead className="w-[180px]">Niveles</TableHead>
            <TableHead className="w-[120px]">Estado</TableHead>
            <TableHead className="w-[140px]">Recibida</TableHead>
            <TableHead className="w-[80px] text-right">Acción</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="font-medium text-foreground">
                  {row.firstName} {row.lastName}
                </div>
                <div className="mt-0.5 font-mono text-[12px] tracking-[0.02em] text-text-3">
                  {row.document}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-foreground">{row.email}</div>
                <div className="mt-0.5 font-mono text-[12px] tracking-[0.02em] text-text-3">
                  {row.phone}
                </div>
              </TableCell>
              <TableCell>
                {row.levels.length === 0 ? (
                  <span className="text-text-4">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {row.levels.slice(0, 3).map((l) => (
                      <Tag key={l.id}>{l.code}</Tag>
                    ))}
                    {row.levels.length > 3 && (
                      <Tag>+{row.levels.length - 3}</Tag>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="font-mono text-[12.5px] tracking-[0.02em] text-text-2">
                {formatDate(row.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/admin/postulaciones/${row.id}` as Route}
                  aria-label={`Ver postulación de ${row.firstName} ${row.lastName}`}
                  title="Ver detalle"
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

const formatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Guayaquil",
})

function formatDate(d: Date): string {
  return formatter.format(d).replace(/\./g, "")
}
