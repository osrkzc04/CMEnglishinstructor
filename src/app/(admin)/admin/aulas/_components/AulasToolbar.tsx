"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import { Plus, Search, X } from "lucide-react"
import { ClassGroupStatus } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Segmented, SegmentedItem } from "@/components/ui/segmented"

/**
 * Toolbar del listado de aulas — búsqueda + filtro de estado + botón
 * "Nueva aula". Mismo patrón URL-driven que el resto del admin.
 */

type Props = {
  initialQuery: string
  initialStatus: ClassGroupStatus | "ALL"
}

export function AulasToolbar({ initialQuery, initialStatus }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<ClassGroupStatus | "ALL">(initialStatus)
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

  function pushFilters(q: string, s: ClassGroupStatus | "ALL") {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (s !== "ALL") params.set("status", s)
    const queryString = params.toString()
    const url = (queryString ? `${pathname}?${queryString}` : pathname) as Route
    startTransition(() => {
      router.replace(url)
    })
  }

  function handleStatusChange(value: string) {
    const next = value as ClassGroupStatus | "ALL"
    setStatus(next)
    pushFilters(query, next)
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="relative max-w-[360px] flex-1 min-w-[220px]">
        <Input
          icon={Search}
          placeholder="Buscar por nombre, programa o nivel…"
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
                className="rounded-md p-1 text-text-3 transition-colors hover:text-foreground"
              >
                <X size={13} strokeWidth={1.6} />
              </button>
            ) : undefined
          }
        />
      </div>

      <Segmented
        value={status}
        onValueChange={handleStatusChange}
        ariaLabel="Filtrar por estado"
      >
        <SegmentedItem value="ALL">Todas</SegmentedItem>
        <SegmentedItem value="ACTIVE">Activas</SegmentedItem>
        <SegmentedItem value="COMPLETED">Cerradas</SegmentedItem>
        <SegmentedItem value="CANCELLED">Canceladas</SegmentedItem>
      </Segmented>

      <div className="ml-auto">
        <Link href={"/admin/aulas/nuevo" as Route}>
          <Button variant="primary" size="md" asChild>
            <span>
              <Plus size={14} strokeWidth={1.6} />
              Nueva aula
            </span>
          </Button>
        </Link>
      </div>
    </div>
  )
}
