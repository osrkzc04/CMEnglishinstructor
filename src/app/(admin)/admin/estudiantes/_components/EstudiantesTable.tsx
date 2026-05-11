"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import { Eye, Power, PowerOff } from "lucide-react"
import { UserStatus } from "@prisma/client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/ui/empty-state"
import { StatusBadge } from "./StatusBadge"
import { setStudentStatus } from "@/modules/students/setStatus.action"
import type { StudentListItem } from "@/modules/students/queries"

/**
 * Tabla del listado de estudiantes. Cada fila tiene:
 *  - acción "Ver detalle" → navega a `/admin/estudiantes/[id]`
 *  - acción contextual "Activar / Desactivar" según estado actual
 *
 * No hay hard-delete: estudiantes acumulan historia (matrículas, sesiones)
 * y se preservan vía status INACTIVE.
 */
export function EstudiantesTable({ items }: { items: StudentListItem[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function toggleStatus(row: StudentListItem) {
    const next: UserStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    startTransition(async () => {
      await setStudentStatus({ id: row.id, status: next })
      router.refresh()
    })
  }

  if (items.length === 0) {
    return (
      <div className="border-border bg-surface rounded-xl border">
        <EmptyState
          title="Sin resultados"
          description="No hay estudiantes que coincidan con los filtros."
        />
      </div>
    )
  }

  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <tr>
            <TableHead className="w-[240px]">Estudiante</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead className="w-[200px]">Empresa / cargo</TableHead>
            <TableHead className="w-[120px]">Estado</TableHead>
            <TableHead className="w-[110px]">Matrículas</TableHead>
            <TableHead className="w-[120px]">Alta</TableHead>
            <TableHead className="w-[160px] text-right">Acciones</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {items.map((row) => {
            const isActive = row.status === "ACTIVE"
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="text-foreground font-medium">
                    {row.firstName} {row.lastName}
                  </div>
                  <div className="text-text-3 mt-0.5 font-mono text-[12px] tracking-[0.02em]">
                    {row.document ?? "—"}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-foreground">{row.email}</div>
                  <div className="text-text-3 mt-0.5 font-mono text-[12px] tracking-[0.02em]">
                    {row.phone ?? "—"}
                  </div>
                </TableCell>
                <TableCell>
                  {row.company ? (
                    <>
                      <div className="text-foreground">{row.company}</div>
                      {row.position && (
                        <div className="text-text-3 mt-0.5 text-[12.5px]">{row.position}</div>
                      )}
                    </>
                  ) : (
                    <span className="text-text-4">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  {row.activeEnrollments > 0 ? (
                    <span className="text-foreground font-mono text-[13px] tracking-[0.02em]">
                      {row.activeEnrollments}{" "}
                      <span className="text-text-3">
                        {row.activeEnrollments === 1 ? "activa" : "activas"}
                      </span>
                    </span>
                  ) : (
                    <span className="text-text-4">—</span>
                  )}
                </TableCell>
                <TableCell className="text-text-2 font-mono text-[12.5px] tracking-[0.02em]">
                  {formatDate(row.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      href={`/admin/estudiantes/${row.id}` as Route}
                      aria-label={`Ver detalle de ${row.firstName} ${row.lastName}`}
                      title="Ver detalle"
                      className="border-border bg-surface text-text-3 grid h-7 w-7 place-items-center rounded-md border transition-colors hover:border-teal-500 hover:text-teal-500"
                    >
                      <Eye size={13} strokeWidth={1.6} />
                    </Link>
                    <button
                      type="button"
                      aria-label={isActive ? "Desactivar estudiante" : "Activar estudiante"}
                      title={isActive ? "Desactivar" : "Activar"}
                      onClick={() => toggleStatus(row)}
                      disabled={isPending}
                      className="border-border bg-surface text-text-3 hover:border-border-strong hover:text-foreground grid h-7 w-7 place-items-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isActive ? (
                        <PowerOff size={13} strokeWidth={1.6} />
                      ) : (
                        <Power size={13} strokeWidth={1.6} />
                      )}
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
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
