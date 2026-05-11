"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import type { Route } from "next"
import {
  Pagination,
  PaginationItem,
  PaginationNext,
  PaginationPrev,
} from "@/components/ui/pagination"

/**
 * Pager URL-driven sobre el primitive Pagination. Calcula la ventana de
 * páginas a mostrar (7 visibles con "…" cuando hace falta) y empuja el
 * cambio de página al URL para que el Server Component vuelva a consultar.
 */
export function PostulacionesPager({
  page,
  totalPages,
  total,
  pageSize,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function goTo(target: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (target <= 1) params.delete("page")
    else params.set("page", String(target))
    const qs = params.toString()
    router.push((qs ? `${pathname}?${qs}` : pathname) as Route)
  }

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  const pages = computePageWindow(page, totalPages)

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="font-mono text-[12px] tracking-[0.02em] text-text-3">
        Mostrando <span className="text-foreground">{start}–{end}</span> de{" "}
        <span className="text-foreground">{total}</span>
      </p>
      <Pagination>
        <PaginationPrev disabled={page <= 1} onClick={() => goTo(page - 1)} />
        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`ellipsis-${i}`}
              aria-hidden
              className="inline-flex min-w-8 items-center justify-center font-mono text-[12.5px] text-text-3"
            >
              …
            </span>
          ) : (
            <PaginationItem
              key={p}
              isCurrent={p === page}
              onClick={() => goTo(p)}
            >
              {p}
            </PaginationItem>
          ),
        )}
        <PaginationNext
          disabled={page >= totalPages}
          onClick={() => goTo(page + 1)}
        />
      </Pagination>
    </div>
  )
}

/** Devuelve la ventana de páginas con elipsis: ej. [1, "…", 4, 5, 6, "…", 12]. */
function computePageWindow(
  current: number,
  total: number,
): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const out: (number | "…")[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) out.push("…")
  for (let i = left; i <= right; i++) out.push(i)
  if (right < total - 1) out.push("…")
  out.push(total)
  return out
}
