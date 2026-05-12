"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import { Eye, Power, PowerOff } from "lucide-react"
import { Role, UserStatus } from "@prisma/client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { StatusBadge } from "@/app/(admin)/admin/estudiantes/_components/StatusBadge"
import { setStaffStatus } from "@/modules/users/setStatus.action"
import type { StaffListItem } from "@/modules/users/queries"

/**
 * Tabla de usuarios staff. Cada fila tiene:
 *  - acción "Ver detalle" → `/admin/usuarios/[id]`
 *  - acción contextual activar / desactivar
 *
 * El director conectado no puede desactivarse a sí mismo desde acá — el
 * botón se deshabilita y la action server lo bloquea de igual modo (defensa
 * en profundidad).
 */
export function UsuariosTable({
  items,
  currentUserId,
}: {
  items: StaffListItem[]
  currentUserId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function toggleStatus(row: StaffListItem) {
    const next: UserStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    startTransition(async () => {
      await setStaffStatus({ id: row.id, status: next })
      router.refresh()
    })
  }

  if (items.length === 0) {
    return (
      <div className="border-border bg-surface rounded-xl border">
        <EmptyState
          title="Sin resultados"
          description="No hay usuarios que coincidan con los filtros."
        />
      </div>
    )
  }

  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <tr>
            <TableHead className="w-[260px]">Usuario</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead className="w-[140px]">Rol</TableHead>
            <TableHead className="w-[120px]">Estado</TableHead>
            <TableHead className="w-[140px]">Acceso</TableHead>
            <TableHead className="w-[120px]">Alta</TableHead>
            <TableHead className="w-[160px] text-right">Acciones</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {items.map((row) => {
            const isActive = row.status === "ACTIVE"
            const isSelf = row.id === currentUserId
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="text-foreground font-medium">
                    {row.firstName} {row.lastName}
                    {isSelf && (
                      <span className="text-text-3 ml-2 text-[11px] tracking-[0.04em] uppercase">
                        tú
                      </span>
                    )}
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
                  <RoleBadge role={row.role} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  {row.hasPassword ? (
                    <span className="text-text-2 text-[12.5px]">Contraseña creada</span>
                  ) : (
                    <span className="text-warning text-[12.5px]">Pendiente de activar</span>
                  )}
                </TableCell>
                <TableCell className="text-text-2 font-mono text-[12.5px] tracking-[0.02em]">
                  {formatDate(row.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      href={`/admin/usuarios/${row.id}` as Route}
                      aria-label={`Ver detalle de ${row.firstName} ${row.lastName}`}
                      title="Ver detalle"
                      className="border-border bg-surface text-text-3 grid h-7 w-7 place-items-center rounded-md border transition-colors hover:border-teal-500 hover:text-teal-500"
                    >
                      <Eye size={13} strokeWidth={1.6} />
                    </Link>
                    <button
                      type="button"
                      aria-label={isActive ? "Desactivar usuario" : "Activar usuario"}
                      title={
                        isSelf
                          ? "No puedes desactivar tu propia cuenta"
                          : isActive
                            ? "Desactivar"
                            : "Activar"
                      }
                      onClick={() => toggleStatus(row)}
                      disabled={isPending || isSelf}
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

function RoleBadge({ role }: { role: Role }) {
  if (role === "DIRECTOR") return <Badge variant="teal">Dirección</Badge>
  if (role === "COORDINATOR") return <Badge variant="default">Coordinación</Badge>
  return <Badge variant="default">{role}</Badge>
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
