"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import { Plus, Search, X } from "lucide-react"
import { UserStatus } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Segmented, SegmentedItem } from "@/components/ui/segmented"

type StaffRoleFilter = "DIRECTOR" | "COORDINATOR"

type Props = {
  initialQuery: string
  initialStatus: UserStatus | "ALL"
  initialRole: StaffRoleFilter | "ALL"
  currentUserId: string
}

export function UsuariosToolbar({ initialQuery, initialStatus, initialRole }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<UserStatus | "ALL">(initialStatus)
  const [role, setRole] = useState<StaffRoleFilter | "ALL">(initialRole)
  const [, startTransition] = useTransition()

  useEffect(() => {
    setQuery(initialQuery)
    setStatus(initialStatus)
    setRole(initialRole)
  }, [initialQuery, initialStatus, initialRole])

  useEffect(() => {
    if (query === initialQuery) return
    const timeout = setTimeout(() => pushFilters(query, status, role), 350)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function pushFilters(q: string, s: UserStatus | "ALL", r: StaffRoleFilter | "ALL") {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (s !== "ALL") params.set("status", s)
    if (r !== "ALL") params.set("role", r)
    const qs = params.toString()
    const url = (qs ? `${pathname}?${qs}` : pathname) as Route
    startTransition(() => {
      router.replace(url)
    })
  }

  function handleStatusChange(value: string) {
    const next = value as UserStatus | "ALL"
    setStatus(next)
    pushFilters(query, next, role)
  }

  function handleRoleChange(value: string) {
    const next = value as StaffRoleFilter | "ALL"
    setRole(next)
    pushFilters(query, status, next)
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="relative max-w-[360px] min-w-[220px] flex-1">
        <Input
          icon={Search}
          placeholder="Buscar por nombre, correo o documento…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          endAdornment={
            query ? (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => {
                  setQuery("")
                  pushFilters("", status, role)
                }}
                className="text-text-3 hover:text-foreground rounded-md p-1 transition-colors"
              >
                <X size={13} strokeWidth={1.6} />
              </button>
            ) : undefined
          }
        />
      </div>

      <Segmented value={role} onValueChange={handleRoleChange} ariaLabel="Filtrar por rol">
        <SegmentedItem value="ALL">Todos los roles</SegmentedItem>
        <SegmentedItem value="DIRECTOR">Dirección</SegmentedItem>
        <SegmentedItem value="COORDINATOR">Coordinación</SegmentedItem>
      </Segmented>

      <Segmented value={status} onValueChange={handleStatusChange} ariaLabel="Filtrar por estado">
        <SegmentedItem value="ALL">Todos</SegmentedItem>
        <SegmentedItem value="ACTIVE">Activos</SegmentedItem>
        <SegmentedItem value="PENDING_APPROVAL">Pendientes</SegmentedItem>
        <SegmentedItem value="INACTIVE">Inactivos</SegmentedItem>
      </Segmented>

      <div className="ml-auto">
        <Link href={"/admin/usuarios/nuevo" as Route}>
          <Button variant="primary" size="md" asChild>
            <span>
              <Plus size={14} strokeWidth={1.6} />
              Nuevo usuario
            </span>
          </Button>
        </Link>
      </div>
    </div>
  )
}
