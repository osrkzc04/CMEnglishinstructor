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
      <div className="rounded-xl border border-border bg-surface">
        <EmptyState
          title="Sin resultados"
          description="No hay estudiantes que coincidan con los filtros."
        />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
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
                  <div className="font-medium text-foreground">
                    {row.firstName} {row.lastName}
                  </div>
                  <div className="mt-0.5 font-mono text-[12px] tracking-[0.02em] text-text-3">
                    {row.document ?? "—"}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-foreground">{row.email}</div>
                  <div className="mt-0.5 font-mono text-[12px] tracking-[0.02em] text-text-3">
                    {row.phone ?? "—"}
                  </div>
                </TableCell>
                <TableCell>
                  {row.company ? (
                    <>
                      <div className="text-foreground">{row.company}</div>
                      {row.position && (
                        <div className="mt-0.5 text-[12.5px] text-text-3">
                          {row.position}
                        </div>
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
                    <span className="font-mono text-[13px] tracking-[0.02em] text-foreground">
                      {row.activeEnrollments}{" "}
                      <span className="text-text-3">
                        {row.activeEnrollments === 1 ? "activa" : "activas"}
                      </span>
                    </span>
                  ) : (
                    <span className="text-text-4">—</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-[12.5px] tracking-[0.02em] text-text-2">
                  {formatDate(row.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      href={`/admin/estudiantes/${row.id}` as Route}
                      aria-label={`Ver detalle de ${row.firstName} ${row.lastName}`}
                      title="Ver detalle"
                      className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-text-3 transition-colors hover:border-teal-500 hover:text-teal-500"
                    >
                      <Eye size={13} strokeWidth={1.6} />
                    </Link>
                    <button
                      type="button"
                      aria-label={
                        isActive ? "Desactivar estudiante" : "Activar estudiante"
                      }
                      title={isActive ? "Desactivar" : "Activar"}
                      onClick={() => toggleStatus(row)}
                      disabled={isPending}
                      className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-text-3 transition-colors hover:border-border-strong hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
