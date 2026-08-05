"use client"

import { Fragment, useMemo, useState } from "react"
import { Info, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  HEATMAP_DAYS,
  HEATMAP_SLOTS_PER_DAY,
  HEATMAP_START_HOUR,
  HEATMAP_SLOT_MINUTES,
  type Heatmap,
  type CellKind,
} from "@/modules/classGroups/heatmap"

/**
 * Grilla visual del matchmaker. Cada celda es una UNIDAD de 15 min; una clase
 * se arma clickeando celdas contiguas del mismo día. Unidades contiguas se
 * agrupan en un "run" (la clase); un hueco corta en dos clases. El largo lo
 * define la cantidad de unidades — así se pueden dictar clases más largas
 * (intensivas) sin quedar atado a la duración por defecto del nivel.
 *
 * Estados de celda (unidad):
 *   - blocked: docente tiene otra aula que se solapa → no clickeable
 *   - gray / students_only: docente no disponible → no clickeable
 *   - teacher_only / partial / match: clickeable
 *
 * Click sobre una celda la agrega/saca del run. La validación de largo mínimo
 * y de no-solapamiento entre runs vive en la action al persistir.
 */

const HOUR_CELLS = 60 / HEATMAP_SLOT_MINUTES
const CELL_HEIGHT_PX = 14

type Slot = { dayOfWeek: number; startTime: string; durationMinutes: number }

type Props = {
  heatmap: Heatmap
  selected: Slot[]
  onChange: (slots: Slot[]) => void
  /** True cuando todavía no hay docente seleccionado — se permite click en
   *  todas las celdas no bloqueadas para definir horario "manual". */
  ignoreTeacher?: boolean
}

function slotToTime(slotIdx: number): string {
  const total = HEATMAP_START_HOUR * 60 + slotIdx * HEATMAP_SLOT_MINUTES
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function startTimeToSlotIdx(time: string): number | null {
  const parts = time.split(":")
  if (parts.length !== 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const total = h * 60 + m - HEATMAP_START_HOUR * 60
  if (total < 0) return null
  if (total % HEATMAP_SLOT_MINUTES !== 0) return null
  const idx = total / HEATMAP_SLOT_MINUTES
  if (idx >= HEATMAP_SLOTS_PER_DAY) return null
  return idx
}

function addMinutesToTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number]
  const total = h * 60 + m + minutes
  const eh = Math.floor(total / 60) % 24
  const em = total % 60
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`
}

// -----------------------------------------------------------------------------
//  Conversión run <-> unidades. La fuente de verdad hacia afuera son los runs
//  (`Slot[]` con duración); internamente togglear una celda es más simple sobre
//  un set de unidades, así que convertimos ida y vuelta en cada click.
// -----------------------------------------------------------------------------

function unitKey(day: number, idx: number): string {
  return `${day}|${idx}`
}

function slotsToUnitSet(slots: Slot[]): Set<string> {
  const set = new Set<string>()
  for (const s of slots) {
    const startIdx = startTimeToSlotIdx(s.startTime)
    if (startIdx === null) continue
    const count = Math.max(1, Math.round(s.durationMinutes / HEATMAP_SLOT_MINUTES))
    for (let i = 0; i < count; i++) {
      const idx = startIdx + i
      if (idx >= HEATMAP_SLOTS_PER_DAY) break
      set.add(unitKey(s.dayOfWeek, idx))
    }
  }
  return set
}

function unitSetToSlots(set: Set<string>): Slot[] {
  const byDay = new Map<number, number[]>()
  for (const key of set) {
    const [d, i] = key.split("|").map(Number) as [number, number]
    const list = byDay.get(d) ?? []
    list.push(i)
    byDay.set(d, list)
  }

  const runs: Slot[] = []
  for (const [day, idxs] of byDay) {
    idxs.sort((a, b) => a - b)
    let start: number | null = null
    let prev: number | null = null
    const flush = (end: number) => {
      if (start === null) return
      runs.push({
        dayOfWeek: day,
        startTime: slotToTime(start),
        durationMinutes: (end - start + 1) * HEATMAP_SLOT_MINUTES,
      })
    }
    for (const idx of idxs) {
      if (start === null) {
        start = idx
        prev = idx
        continue
      }
      if (idx === prev! + 1) {
        prev = idx
        continue
      }
      flush(prev!)
      start = idx
      prev = idx
    }
    if (prev !== null) flush(prev)
  }

  runs.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
  return runs
}

// Colores por estado (unidad). La intensidad refleja qué tan "cerrada" está:
// match usa teal; partial amarillo; los informativos (solo docente/alumnos)
// tonos bajos para no competir con el match.
const KIND_BG: Record<CellKind, string> = {
  blocked: "bg-danger/15 cursor-not-allowed",
  gray: "bg-bone-100 cursor-not-allowed",
  students_only: "bg-bone-100 cursor-not-allowed",
  teacher_only: "bg-info/10 hover:bg-info/20 cursor-pointer",
  partial: "bg-warning/20 hover:bg-warning/30 cursor-pointer",
  match: "bg-teal-500/30 hover:bg-teal-500/45 cursor-pointer",
}

export function MatchHeatmap({ heatmap, selected, onChange, ignoreTeacher }: Props) {
  const [hover, setHover] = useState<{ dayIdx: number; slotIdx: number } | null>(null)

  // Duración estándar del nivel — se usa solo para marcar runs "cortos" (por
  // debajo de una clase normal), no para restringir la selección.
  const standardDuration = heatmap.durationMinutes

  // Indexar celdas del heatmap para búsqueda rápida.
  const cellMap = new Map<string, (typeof heatmap.cells)[number]>()
  for (const c of heatmap.cells) {
    cellMap.set(`${c.dayOfWeek}|${c.startTime}`, c)
  }

  function cellClickable(kind: CellKind): boolean {
    if (kind === "blocked") return false
    if (kind === "gray") return false
    if (kind === "students_only") return false
    // teacher_only / partial / match → clickeable. En modo "sin docente"
    // también, para armar horarios placeholder.
    return true
  }

  // Por cada celda del grid, saber si pertenece a un run seleccionado, si es su
  // primera unidad (lleva el label) y qué run es (para el largo y quitar).
  const selectedSpanByUnit = useMemo(() => {
    const map = new Map<string, { isFirst: boolean; run: Slot }>()
    for (const run of selected) {
      const startIdx = startTimeToSlotIdx(run.startTime)
      if (startIdx === null) continue
      const count = Math.max(1, Math.round(run.durationMinutes / HEATMAP_SLOT_MINUTES))
      for (let i = 0; i < count; i++) {
        const idx = startIdx + i
        if (idx >= HEATMAP_SLOTS_PER_DAY) break
        map.set(unitKey(run.dayOfWeek, idx), { isFirst: i === 0, run })
      }
    }
    return map
  }, [selected])

  function toggleUnit(day: number, idx: number, clickable: boolean) {
    const set = slotsToUnitSet(selected)
    const key = unitKey(day, idx)
    if (set.has(key)) {
      // Quitar una unidad siempre se permite (puede partir un run en dos).
      set.delete(key)
    } else {
      if (!clickable) return
      set.add(key)
    }
    onChange(unitSetToSlots(set))
  }

  return (
    <div className="select-none">
      <div className="border-border bg-bone-50 text-text-2 mb-3 flex items-start gap-2 rounded-md border px-3 py-2 text-[12.5px]">
        <Info size={13} strokeWidth={1.6} className="text-text-3 mt-0.5 shrink-0" />
        <p>
          Cada celda es una <strong>unidad de 15 min</strong>. Haz clic en celdas contiguas para
          armar una clase; el largo lo defines tú. La duración estándar del nivel es{" "}
          <span className="font-mono">{standardDuration} min</span> — los bloques más cortos se
          marcan en ámbar.
        </p>
      </div>
      <div className="border-border bg-surface overflow-hidden rounded-lg border">
        {/* Header de días */}
        <div className="border-border bg-surface-alt grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b">
          <div />
          {HEATMAP_DAYS.map((d) => (
            <div
              key={d.idx}
              className="border-border text-text-3 border-l px-2 py-2 text-center font-mono text-[11px] tracking-[0.08em] uppercase"
            >
              {d.short}
            </div>
          ))}
        </div>

        {/* Cuerpo */}
        <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))]">
          {Array.from({ length: HEATMAP_SLOTS_PER_DAY }).map((_, slotIdx) => {
            const isHour = slotIdx % HOUR_CELLS === 0
            const isHalf = slotIdx % HOUR_CELLS === HOUR_CELLS / 2
            const startTime = slotToTime(slotIdx)
            return (
              <Fragment key={slotIdx}>
                <div
                  className={cn(
                    "flex items-start justify-end pr-2 font-mono tracking-[0.02em]",
                    isHour
                      ? "border-border text-text-3 border-t text-[10.5px]"
                      : isHalf
                        ? "text-text-4 text-[10px]"
                        : "text-text-4",
                  )}
                  style={{
                    height: `${CELL_HEIGHT_PX}px`,
                    lineHeight: `${CELL_HEIGHT_PX}px`,
                  }}
                >
                  {isHour || isHalf ? startTime : ""}
                </div>
                {HEATMAP_DAYS.map((d) => {
                  const cell = cellMap.get(`${d.idx}|${startTime}`)
                  const spanInfo = selectedSpanByUnit.get(unitKey(d.idx, slotIdx)) ?? null
                  const isInSelectedSpan = spanInfo !== null
                  const isFirstOfRun = spanInfo?.isFirst === true
                  const clickable = cell ? cellClickable(cell.kind) : false
                  const conflictName = cell?.teacherConflicts[0]?.classGroupName
                  const isHovered =
                    hover?.dayIdx === d.idx && hover?.slotIdx === slotIdx && !isInSelectedSpan

                  const run = spanInfo?.run
                  const runEnd = run ? addMinutesToTime(run.startTime, run.durationMinutes) : ""
                  const runIsShort = run ? run.durationMinutes < standardDuration : false

                  return (
                    <button
                      key={`${d.idx}|${startTime}`}
                      type="button"
                      disabled={!clickable && !isInSelectedSpan}
                      onClick={() => toggleUnit(d.idx, slotIdx, clickable)}
                      onMouseEnter={() => {
                        if (clickable && !isInSelectedSpan) {
                          setHover({ dayIdx: d.idx, slotIdx })
                        }
                      }}
                      onMouseLeave={() => {
                        setHover((curr) =>
                          curr && curr.dayIdx === d.idx && curr.slotIdx === slotIdx ? null : curr,
                        )
                      }}
                      title={
                        run
                          ? `Clase ${run.startTime} – ${runEnd} · ${run.durationMinutes} min${
                              runIsShort ? " (más corta que la estándar)" : ""
                            } · click para editar`
                          : cell
                            ? buildTitle(cell, ignoreTeacher, conflictName, startTime)
                            : ""
                      }
                      aria-pressed={isInSelectedSpan}
                      className={cn(
                        "relative border-l transition-colors",
                        // Dentro de un run: las unidades interiores pierden el
                        // borde-top para verse como una barra continua.
                        isInSelectedSpan && !isFirstOfRun
                          ? runIsShort
                            ? "border-l-warning/50"
                            : "border-l-teal-700/50"
                          : "border-l-border",
                        isInSelectedSpan &&
                          isFirstOfRun &&
                          (runIsShort ? "border-t-2 border-t-warning" : "border-t-2 border-t-teal-700"),
                        !isInSelectedSpan && isHour && "border-border border-t",
                        !isInSelectedSpan && !isHour && isHalf && "border-border/30 border-t",
                        // Color de fondo del run seleccionado.
                        isInSelectedSpan &&
                          (runIsShort
                            ? "cursor-pointer bg-warning text-white hover:bg-warning/80"
                            : "cursor-pointer bg-teal-600 text-white hover:bg-teal-700"),
                        !isInSelectedSpan && cell && KIND_BG[cell.kind],
                        !cell && !isInSelectedSpan && "bg-surface",
                        // Ring de hover (solo en celda libre clickeable).
                        isHovered && "z-10 ring-1 ring-teal-500/60 ring-inset",
                      )}
                      style={{ height: `${CELL_HEIGHT_PX}px` }}
                    >
                      {isFirstOfRun && run && (
                        <span className="block text-center font-mono text-[9.5px] leading-[14px] font-semibold tracking-[0.02em] text-white">
                          {run.startTime}–{runEnd}
                        </span>
                      )}
                      {!isInSelectedSpan && cell?.kind === "blocked" && (
                        <X size={10} strokeWidth={1.6} className="text-danger/60 mx-auto" />
                      )}
                      {/* n/total solo en match parcial real (algunos sí, algunos no). */}
                      {!isInSelectedSpan && cell?.kind === "partial" && cell.studentsTotal > 1 && (
                        <span className="text-warning block text-center font-mono text-[9.5px] leading-[14px]">
                          {cell.studentsCovered}/{cell.studentsTotal}
                        </span>
                      )}
                    </button>
                  )
                })}
              </Fragment>
            )
          })}
        </div>
      </div>

      <Legend />
    </div>
  )
}

function Legend() {
  return (
    <ul className="text-text-3 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
      <LegendItem
        swatchClass="bg-teal-500/40 border border-teal-500/50"
        label="Match — docente y todos los alumnos disponibles"
      />
      <LegendItem
        swatchClass="bg-warning/30 border border-warning/40"
        label="Match parcial — algunos alumnos no cubren (n/total)"
      />
      <LegendItem swatchClass="bg-info/15 border border-info/30" label="Solo docente disponible" />
      <LegendItem swatchClass="bg-bone-100 border border-border" label="Sin disponibilidad" />
      <LegendItem
        swatchClass="bg-danger/15 border border-danger/30"
        label="Choca con otra aula del docente"
      />
      <LegendItem swatchClass="bg-teal-600 border border-teal-700" label="Clase elegida" />
      <LegendItem
        swatchClass="bg-warning border border-warning"
        label="Clase más corta que la estándar"
      />
    </ul>
  )
}

function LegendItem({ swatchClass, label }: { swatchClass: string; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", swatchClass)} />
      {label}
    </li>
  )
}

function buildTitle(
  cell: { kind: CellKind; studentsCovered: number; studentsTotal: number },
  ignoreTeacher: boolean | undefined,
  conflictName: string | undefined,
  startTime: string,
): string {
  const end = addMinutesToTime(startTime, HEATMAP_SLOT_MINUTES)
  const range = `${startTime}–${end}`
  switch (cell.kind) {
    case "blocked":
      return `${range} · el docente ya dicta ${conflictName ?? "otra aula"} en este horario`
    case "gray":
      return `${range} · sin disponibilidad`
    case "students_only":
      return cell.studentsTotal > 0
        ? `${range} · ${cell.studentsCovered} de ${cell.studentsTotal} alumnos cubren, pero el docente no`
        : `${range} · sin disponibilidad del docente`
    case "teacher_only":
      return ignoreTeacher
        ? `${range} · docente disponible (sin alumnos seleccionados)`
        : cell.studentsTotal === 0
          ? `${range} · docente disponible. Selecciona estudiantes para ver matches`
          : `${range} · docente disponible, pero ningún alumno cubre esta unidad`
    case "partial":
      return `${range} · ${cell.studentsCovered} de ${cell.studentsTotal} alumnos disponibles`
    case "match":
      return `${range} · match completo — docente y todos los alumnos disponibles`
    default:
      return ""
  }
}
