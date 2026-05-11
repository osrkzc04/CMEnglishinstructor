"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import type { Route } from "next"
import {
  Pagination,
  PaginationItem,
  PaginationNext,
  PaginationPrev,
} from "@/components/ui/pagination"

export function DocentesPager({
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
      <p className="text-text-3 font-mono text-[12px] tracking-[0.02em]">
        Mostrando{" "}
        <span className="text-foreground">
          {start}–{end}
        </span>{" "}
        de <span className="text-foreground">{total}</span>
      </p>
      <Pagination>
        <PaginationPrev disabled={page <= 1} onClick={() => goTo(page - 1)} />
        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`ellipsis-${i}`}
              aria-hidden
              className="text-text-3 inline-flex min-w-8 items-center justify-center font-mono text-[12.5px]"
            >
              …
            </span>
          ) : (
            <PaginationItem key={p} isCurrent={p === page} onClick={() => goTo(p)}>
              {p}
            </PaginationItem>
          ),
        )}
        <PaginationNext disabled={page >= totalPages} onClick={() => goTo(page + 1)} />
      </Pagination>
    </div>
  )
}

function computePageWindow(current: number, total: number): (number | "…")[] {
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
