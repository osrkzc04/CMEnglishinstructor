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

/**
 * Toolbar del listado de docentes — búsqueda + filtro de estado + alta nueva.
 * URL-driven con debounce en el input para no martillar el server.
 */

type Props = {
  initialQuery: string
  initialStatus: UserStatus | "ALL"
}

export function DocentesToolbar({ initialQuery, initialStatus }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<UserStatus | "ALL">(initialStatus)
  const [, startTransition] = useTransition()

  useEffect(() => {
    setQuery(initialQuery)
    setStatus(initialStatus)
  }, [initialQuery, initialStatus])

  useEffect(() => {
    if (query === initialQuery) return
    const timeout = setTimeout(() => pushFilters(query, status), 350)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function pushFilters(q: string, s: UserStatus | "ALL") {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (s !== "ALL") params.set("status", s)
    const qs = params.toString()
    const url = (qs ? `${pathname}?${qs}` : pathname) as Route
    startTransition(() => {
      router.replace(url)
    })
  }

  function handleStatusChange(value: string) {
    const next = value as UserStatus | "ALL"
    setStatus(next)
    pushFilters(query, next)
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
                  pushFilters("", status)
                }}
                className="text-text-3 hover:text-foreground rounded-md p-1 transition-colors"
              >
                <X size={13} strokeWidth={1.6} />
              </button>
            ) : undefined
          }
        />
      </div>

      <Segmented value={status} onValueChange={handleStatusChange} ariaLabel="Filtrar por estado">
        <SegmentedItem value="ALL">Todos</SegmentedItem>
        <SegmentedItem value="ACTIVE">Activos</SegmentedItem>
        <SegmentedItem value="INACTIVE">Inactivos</SegmentedItem>
      </Segmented>

      <div className="ml-auto">
        <Link href={"/admin/docentes/nuevo" as Route}>
          <Button variant="primary" size="md" asChild>
            <span>
              <Plus size={14} strokeWidth={1.6} />
              Nuevo docente
            </span>
          </Button>
        </Link>
      </div>
    </div>
  )
}
