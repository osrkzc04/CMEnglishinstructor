"use client"

import { useRouter, usePathname } from "next/navigation"
import type { Route } from "next"
import type { AvailableLanguage } from "@/modules/questions/queries"

/**
 * Selector de idioma del banco. Solo se renderiza si la academia tiene más
 * de un idioma activo en `Language`. Al cambiar, resetea todos los filtros
 * (nivel, tipo, tópico) porque las taxonomías son por idioma.
 */
export function LanguageSwitcher({
  languages,
  current,
}: {
  languages: AvailableLanguage[]
  current: string
}) {
  const router = useRouter()
  const pathname = usePathname()

  if (languages.length <= 1) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">Idioma</span>
      <div className="border-border bg-surface inline-flex items-center gap-0.5 rounded-md border p-0.5">
        {languages.map((l) => {
          const active = l.id === current
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => {
                const params = new URLSearchParams()
                params.set("languageId", l.id)
                router.push(`${pathname}?${params.toString()}` as Route)
              }}
              className={
                active
                  ? "bg-ink-900 dark:bg-bone text-bone dark:text-ink-900 rounded-[5px] px-2.5 py-1 text-[12px] font-medium"
                  : "text-text-2 hover:text-foreground rounded-[5px] px-2.5 py-1 text-[12px] transition-colors"
              }
            >
              {l.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
