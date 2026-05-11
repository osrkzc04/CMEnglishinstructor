"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import type { Route } from "next"
import { Search, X } from "lucide-react"
import { ApplicationStatus } from "@prisma/client"
import { Input } from "@/components/ui/input"
import { Segmented, SegmentedItem } from "@/components/ui/segmented"

/**
 * Toolbar del listado de postulaciones — búsqueda + filtro de estado.
 *
 * La búsqueda se debouncea (350ms) y se sincroniza al URL via
 * `router.replace` para que el Server Component vuelva a consultar con la
 * cláusula `where` apropiada. Todo se escribe en `?q & ?status` — no hay
 * estado paralelo en cliente.
 *
 * Sin botón de "Nueva postulación" — el alta entra solo por el form
 * público `/postular-docente`.
 */

type Props = {
  initialQuery: string
  initialStatus: ApplicationStatus | "ALL"
}

export function PostulacionesToolbar({ initialQuery, initialStatus }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<ApplicationStatus | "ALL">(initialStatus)
  const [, startTransition] = useTransition()

  // Sincroniza el estado interno cuando los searchParams cambian por
  // navegación externa (ej. clic en pager). Si la URL difiere del input,
  // adoptamos el valor de la URL.
  useEffect(() => {
    setQuery(initialQuery)
    setStatus(initialStatus)
  }, [initialQuery, initialStatus])

  // Debounce de la búsqueda: cada vez que cambia `query`, esperamos 350ms
  // antes de pushear al URL — evita una request por cada tecla.
  useEffect(() => {
    if (query === initialQuery) return
    const timeout = setTimeout(() => pushFilters(query, status), 350)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function pushFilters(q: string, s: ApplicationStatus | "ALL") {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (s !== "ALL") params.set("status", s)
    // El cambio de filtros siempre vuelve a la página 1 — la página vieja
    // probablemente queda fuera del resultado filtrado.
    const queryString = params.toString()
    const url = (queryString ? `${pathname}?${queryString}` : pathname) as Route
    startTransition(() => {
      router.replace(url)
    })
  }

  function handleStatusChange(value: string) {
    const next = value as ApplicationStatus | "ALL"
    setStatus(next)
    pushFilters(query, next)
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="relative max-w-[360px] flex-1 min-w-[220px]">
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
        <SegmentedItem value="PENDING">Pendientes</SegmentedItem>
        <SegmentedItem value="APPROVED">Aprobadas</SegmentedItem>
        <SegmentedItem value="REJECTED">Rechazadas</SegmentedItem>
      </Segmented>
    </div>
  )
}
