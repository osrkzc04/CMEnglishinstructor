"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import { Plus, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Segmented, SegmentedItem } from "@/components/ui/segmented"
import type { InviteState } from "@/modules/tests/invites/queries"

type StateFilter = InviteState | "ALL"

type Props = {
  initialQuery: string
  initialState: StateFilter
}

export function PruebasToolbar({ initialQuery, initialState }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(initialQuery)
  const [state, setState] = useState<StateFilter>(initialState)
  const [, startTransition] = useTransition()

  useEffect(() => {
    setQuery(initialQuery)
    setState(initialState)
  }, [initialQuery, initialState])

  useEffect(() => {
    if (query === initialQuery) return
    const timeout = setTimeout(() => pushFilters(query, state), 350)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function pushFilters(q: string, s: StateFilter) {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (s !== "ALL") params.set("state", s)
    const qs = params.toString()
    const url = (qs ? `${pathname}?${qs}` : pathname) as Route
    startTransition(() => {
      router.replace(url)
    })
  }

  function handleStateChange(value: string) {
    const next = value as StateFilter
    setState(next)
    pushFilters(query, next)
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="relative max-w-[360px] min-w-[220px] flex-1">
        <Input
          icon={Search}
          placeholder="Buscar por candidato, correo o documento…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          endAdornment={
            query ? (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => {
                  setQuery("")
                  pushFilters("", state)
                }}
                className="text-text-3 hover:text-foreground rounded-md p-1 transition-colors"
              >
                <X size={13} strokeWidth={1.6} />
              </button>
            ) : undefined
          }
        />
      </div>

      <Segmented value={state} onValueChange={handleStateChange} ariaLabel="Filtrar por estado">
        <SegmentedItem value="ALL">Todas</SegmentedItem>
        <SegmentedItem value="PENDING">Por entregar</SegmentedItem>
        <SegmentedItem value="IN_PROGRESS">En curso</SegmentedItem>
        <SegmentedItem value="SUBMITTED">Por revisar</SegmentedItem>
        <SegmentedItem value="REVIEWED">Revisadas</SegmentedItem>
      </Segmented>

      <div className="ml-auto">
        <Link href={"/admin/pruebas/nueva" as Route}>
          <Button variant="primary" size="md" asChild>
            <span>
              <Plus size={14} strokeWidth={1.6} />
              Nueva evaluación
            </span>
          </Button>
        </Link>
      </div>
    </div>
  )
}
