"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import { ArrowRight, Power, PowerOff } from "lucide-react"
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
import { setTeacherStatus } from "@/modules/teachers/setStatus.action"
import type { TeacherListItem } from "@/modules/teachers/queries"

/**
 * Tabla del listado de docentes. Cada fila lleva al detalle individual y
 * permite alternar el estado activo/inactivo sin abandonar la pantalla.
 */
export function DocentesTable({ items }: { items: TeacherListItem[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function toggleStatus(row: TeacherListItem) {
    const next: UserStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    startTransition(async () => {
      await setTeacherStatus({ id: row.id, status: next })
      router.refresh()
    })
  }

  if (items.length === 0) {
    return (
      <div className="border-border bg-surface rounded-xl border">
        <EmptyState
          title="Sin resultados"
          description="No hay docentes que coincidan con los filtros."
        />
      </div>
    )
  }

  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <tr>
            <TableHead className="w-[240px]">Docente</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead className="w-[110px]">Niveles</TableHead>
            <TableHead className="w-[140px]">Disponibilidad</TableHead>
            <TableHead className="w-[120px]">Asignaciones</TableHead>
            <TableHead className="w-[120px]">Estado</TableHead>
            <TableHead className="w-[88px] text-right">Acciones</TableHead>
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
                  {row.levelCount > 0 ? (
                    <span className="text-foreground font-mono text-[13px] tracking-[0.02em]">
                      {row.levelCount}
                    </span>
                  ) : (
                    <span className="text-text-4">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {row.availabilityHours > 0 ? (
                    <span className="text-text-2 font-mono text-[12.5px] tracking-[0.02em]">
                      {formatHours(row.availabilityHours)}{" "}
                      <span className="text-text-3">h/sem</span>
                    </span>
                  ) : (
                    <span className="text-text-4">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {row.activeAssignments > 0 ? (
                    <span className="text-foreground font-mono text-[13px] tracking-[0.02em]">
                      {row.activeAssignments}{" "}
                      <span className="text-text-3">
                        {row.activeAssignments === 1 ? "vigente" : "vigentes"}
                      </span>
                    </span>
                  ) : (
                    <span className="text-text-4">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      href={`/admin/docentes/${row.id}` as Route}
                      aria-label={`Ver detalle de ${row.firstName} ${row.lastName}`}
                      title="Ver detalle"
                      className="border-border bg-surface text-text-3 grid h-7 w-7 place-items-center rounded-md border transition-colors hover:border-teal-500 hover:text-teal-500"
                    >
                      <ArrowRight size={13} strokeWidth={1.6} />
                    </Link>
                    <button
                      type="button"
                      aria-label={isActive ? "Desactivar docente" : "Activar docente"}
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

function formatHours(hours: number): string {
  if (Number.isInteger(hours)) return String(hours)
  return hours.toFixed(1).replace(/\.0$/, "")
}
