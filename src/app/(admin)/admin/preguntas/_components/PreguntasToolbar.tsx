"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import type { Route } from "next"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Segmented, SegmentedItem } from "@/components/ui/segmented"
import type { QuestionStatusFilter } from "@/modules/questions/schemas"
import type { CefrLevelLite } from "@/modules/questions/queries"

type TypeFilter = "ALL" | "MULTIPLE_CHOICE" | "FILL_IN"

type Props = {
  initialQuery: string
  initialStatus: QuestionStatusFilter
  initialLevelId: string | "ALL"
  initialType: TypeFilter
  initialTopic: string
  cefrLevels: CefrLevelLite[]
  topics: string[]
  // languageId no se muestra como filtro (la pantalla lo recibe en la URL).
  // Aquí lo aceptamos para preservarlo al pushear cambios.
  languageId: string | null
  /**
   * Si estamos dentro de la vista de un solo nivel (drill-in), no tiene
   * sentido mostrar el chip-group de niveles — el nivel viene fijado por la
   * URL del padre.
   */
  hideLevelFilter?: boolean
}

export function PreguntasToolbar({
  initialQuery,
  initialStatus,
  initialLevelId,
  initialType,
  initialTopic,
  cefrLevels,
  topics,
  languageId,
  hideLevelFilter,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(initialQuery)
  const [topic, setTopic] = useState(initialTopic)
  const [status, setStatus] = useState<QuestionStatusFilter>(initialStatus)
  const [levelId, setLevelId] = useState<string | "ALL">(initialLevelId)
  const [type, setType] = useState<TypeFilter>(initialType)
  const [, startTransition] = useTransition()

  useEffect(() => {
    setQuery(initialQuery)
    setStatus(initialStatus)
    setLevelId(initialLevelId)
    setType(initialType)
    setTopic(initialTopic)
  }, [initialQuery, initialStatus, initialLevelId, initialType, initialTopic])

  // Debounce de búsqueda por texto.
  useEffect(() => {
    if (query === initialQuery) return
    const timeout = setTimeout(() => {
      pushFilters({ query, topic, status, levelId, type })
    }, 350)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function pushFilters(next: {
    query: string
    topic: string
    status: QuestionStatusFilter
    levelId: string | "ALL"
    type: TypeFilter
  }) {
    const params = new URLSearchParams()
    if (next.query) params.set("q", next.query)
    if (next.topic) params.set("topic", next.topic)
    if (next.status !== "ACTIVE") params.set("status", next.status)
    // Si el filtro de nivel está oculto, el levelId viene del path — no lo
    // duplicamos en el querystring.
    if (!hideLevelFilter && next.levelId !== "ALL") params.set("levelId", next.levelId)
    if (next.type !== "ALL") params.set("type", next.type)
    if (languageId) params.set("languageId", languageId)
    const qs = params.toString()
    const url = (qs ? `${pathname}?${qs}` : pathname) as Route
    startTransition(() => {
      router.replace(url)
    })
  }

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-[420px] min-w-[240px] flex-1">
          <Input
            icon={Search}
            placeholder="Buscar por enunciado…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            endAdornment={
              query ? (
                <button
                  type="button"
                  aria-label="Limpiar búsqueda"
                  onClick={() => {
                    setQuery("")
                    pushFilters({ query: "", topic, status, levelId, type })
                  }}
                  className="text-text-3 hover:text-foreground rounded-md p-1 transition-colors"
                >
                  <X size={13} strokeWidth={1.6} />
                </button>
              ) : undefined
            }
          />
        </div>

        <Segmented
          value={status}
          onValueChange={(v) => {
            const next = v as QuestionStatusFilter
            setStatus(next)
            pushFilters({ query, topic, status: next, levelId, type })
          }}
          ariaLabel="Filtrar por estado"
        >
          <SegmentedItem value="ACTIVE">Activas</SegmentedItem>
          <SegmentedItem value="INACTIVE">Inactivas</SegmentedItem>
          <SegmentedItem value="ALL">Todas</SegmentedItem>
        </Segmented>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!hideLevelFilter && (
          <FilterChipGroup
            label="Nivel"
            value={levelId}
            options={[
              { value: "ALL", label: "Todos" },
              ...cefrLevels.map((l) => ({ value: l.id, label: l.code })),
            ]}
            onChange={(v) => {
              setLevelId(v)
              pushFilters({ query, topic, status, levelId: v, type })
            }}
          />
        )}

        <FilterChipGroup
          label="Tipo"
          value={type}
          options={[
            { value: "ALL", label: "Todos" },
            { value: "MULTIPLE_CHOICE", label: "Opción múltiple" },
            { value: "FILL_IN", label: "Completar" },
          ]}
          onChange={(v) => {
            const next = v as TypeFilter
            setType(next)
            pushFilters({ query, topic, status, levelId, type: next })
          }}
        />

        {topics.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
              Tópico
            </span>
            <select
              value={topic}
              onChange={(e) => {
                const v = e.target.value
                setTopic(v)
                pushFilters({ query, topic: v, status, levelId, type })
              }}
              className="border-border bg-surface text-foreground hover:border-border-strong rounded-md border px-2.5 py-1.5 text-[12.5px] transition-colors focus:border-teal-500 focus:outline-none"
            >
              <option value="">Todos</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}

function FilterChipGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (next: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">{label}</span>
      <div className="border-border bg-surface inline-flex items-center gap-0.5 rounded-md border p-0.5">
        {options.map((opt) => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={
                active
                  ? "bg-ink-900 dark:bg-bone text-bone dark:text-ink-900 rounded-[5px] px-2.5 py-1 text-[12px] font-medium"
                  : "text-text-2 hover:text-foreground rounded-[5px] px-2.5 py-1 text-[12px] transition-colors"
              }
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
