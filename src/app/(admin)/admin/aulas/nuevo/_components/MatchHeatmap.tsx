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
 * Grilla visual del matchmaker. Cada celda representa "arrancar la clase
 * acá"; el alto de la fila marca un bloque de 15 min y la duración real del
 * slot la fija el `Course.classDuration`.
 *
 * Estados:
 *   - blocked: docente tiene otra aula que se solapa → no clickeable
 *   - gray:    docente no disponible → no clickeable
 *   - yellow:  docente cubre + algunos estudiantes → clickeable, con conteo
 *   - green:   docente cubre + todos los estudiantes → clickeable
 *
 * Click en una celda: agrega/saca el slot de la lista. La grilla no se
 * encarga de validar que no se elijan dos slots solapados — eso lo valida
 * la action al persistir.
 */

const HOUR_CELLS = 60 / HEATMAP_SLOT_MINUTES
const CELL_HEIGHT_PX = 14

type Slot = { dayOfWeek: number; startTime: string }

type Props = {
  heatmap: Heatmap
  selected: Slot[]
  onChange: (slots: Slot[]) => void
  /** True cuando todavía no hay docente seleccionado — se permite click en
   *  todas las celdas no bloqueadas para definir horario "manual". */
  ignoreTeacher?: boolean
}

function slotKey(s: Slot): string {
  return `${s.dayOfWeek}|${s.startTime}`
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

// Colores por estado. La intensidad refleja qué tan "cerrado" está el slot:
// match (todos disponibles) usa teal sólido; partial usa amarillo; los
// estados parciales informativos (solo docente, solo alumnos) usan tonos
// muy bajos para no competir visualmente con el match.
const KIND_BG: Record<CellKind, string> = {
  blocked: "bg-danger/15 cursor-not-allowed",
  gray: "bg-bone-100 cursor-not-allowed",
  students_only: "bg-bone-100 cursor-not-allowed",
  teacher_only: "bg-info/10 hover:bg-info/20 cursor-pointer",
  partial: "bg-warning/20 hover:bg-warning/30 cursor-pointer",
  match: "bg-teal-500/30 hover:bg-teal-500/45 cursor-pointer",
}

export function MatchHeatmap({ heatmap, selected, onChange, ignoreTeacher }: Props) {
  const [hover, setHover] = useState<{ dayIdx: number; startSlotIdx: number } | null>(
    null,
  )

  // Cuántas celdas de 15 min ocupa una clase. Se usa para resaltar el span
  // al pasar el mouse y para la advertencia de "este horario es el INICIO".
  const cellsPerClass = Math.max(
    1,
    Math.ceil(heatmap.durationMinutes / HEATMAP_SLOT_MINUTES),
  )

  // Indexar celdas para búsqueda rápida
  const cellMap = new Map<string, (typeof heatmap.cells)[number]>()
  for (const c of heatmap.cells) {
    cellMap.set(`${c.dayOfWeek}|${c.startTime}`, c)
  }
  const selectedKeys = new Set(selected.map(slotKey))

  function cellClickable(kind: CellKind): boolean {
    if (kind === "blocked") return false
    if (kind === "gray") return false
    if (kind === "students_only") return false
    // En modo "sin docente" todas las celdas no bloqueadas se pueden marcar
    // a mano para horarios placeholder.
    if (ignoreTeacher) return true
    return true
  }

  function isInHoverSpan(dayIdx: number, slotIdx: number): boolean {
    if (!hover) return false
    if (hover.dayIdx !== dayIdx) return false
    return (
      slotIdx >= hover.startSlotIdx &&
      slotIdx < hover.startSlotIdx + cellsPerClass
    )
  }

  function endTimeForStart(startTime: string): string {
    const [h, m] = startTime.split(":").map(Number) as [number, number]
    const endTotal = h * 60 + m + heatmap.durationMinutes
    const eh = Math.floor(endTotal / 60) % 24
    const em = endTotal % 60
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`
  }

  // Por cada celda del grid, sabemos si está dentro del span de algún slot
  // seleccionado, y si sí, si es la "primera" (la del inicio) o "interior".
  // Eso permite renderizar el slot como una barra continua: la primera lleva
  // el label, las interiores pierden el borde-top para parecer una sola pieza.
  const selectedSpanByDayAndSlot = useMemo(() => {
    const map = new Map<string, { isFirst: boolean; startTime: string }>()
    for (const s of selected) {
      const startIdx = startTimeToSlotIdx(s.startTime)
      if (startIdx === null) continue
      for (let i = 0; i < cellsPerClass; i++) {
        const idx = startIdx + i
        if (idx >= HEATMAP_SLOTS_PER_DAY) break
        map.set(`${s.dayOfWeek}|${idx}`, {
          isFirst: i === 0,
          startTime: s.startTime,
        })
      }
    }
    return map
  }, [selected, cellsPerClass])

  function getSelectedSpanInfo(
    dayIdx: number,
    slotIdx: number,
  ): { isFirst: boolean; startTime: string } | null {
    return selectedSpanByDayAndSlot.get(`${dayIdx}|${slotIdx}`) ?? null
  }

  function toggle(s: Slot) {
    const key = slotKey(s)
    if (selectedKeys.has(key)) {
      onChange(selected.filter((x) => slotKey(x) !== key))
    } else {
      onChange([...selected, s].sort(sortSlots))
    }
  }

  return (
    <div className="select-none">
      <div className="mb-3 flex items-start gap-2 rounded-md border border-border bg-bone-50 px-3 py-2 text-[12.5px] text-text-2">
        <Info size={13} strokeWidth={1.6} className="mt-0.5 shrink-0 text-text-3" />
        <p>
          Cada celda es <strong>el inicio</strong> de una clase de{" "}
          <span className="font-mono">{heatmap.durationMinutes} min</span>. Pasá
          el mouse para ver qué celdas ocupa la clase a partir de ahí. Las
          celdas que aparecen sin color son inicios donde la clase no entra
          dentro de la franja disponible de alguien.
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {/* Header de días */}
        <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-border bg-surface-alt">
          <div />
          {HEATMAP_DAYS.map((d) => (
            <div
              key={d.idx}
              className="border-l border-border px-2 py-2 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-text-3"
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
                      ? "border-t border-border text-[10.5px] text-text-3"
                      : isHalf
                        ? "text-[10px] text-text-4"
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
                  const spanInfo = getSelectedSpanInfo(d.idx, slotIdx)
                  const isInSelectedSpan = spanInfo !== null
                  const isFirstOfSlot = spanInfo?.isFirst === true
                  const clickable = cell ? cellClickable(cell.kind) : false
                  const conflictName = cell?.teacherConflicts[0]?.classGroupName
                  const inHoverSpan =
                    !isInSelectedSpan && isInHoverSpan(d.idx, slotIdx)
                  const endTime = endTimeForStart(startTime)
                  const slotEndTime = isFirstOfSlot
                    ? endTimeForStart(spanInfo!.startTime)
                    : ""

                  return (
                    <button
                      key={`${d.idx}|${startTime}`}
                      type="button"
                      disabled={!clickable && !isInSelectedSpan}
                      onClick={() => {
                        if (isInSelectedSpan) {
                          // Click en cualquier celda del span deselecciona el
                          // slot original (cuyo inicio puede no ser este).
                          toggle({
                            dayOfWeek: d.idx,
                            startTime: spanInfo!.startTime,
                          })
                          return
                        }
                        if (!clickable) return
                        toggle({ dayOfWeek: d.idx, startTime })
                      }}
                      onMouseEnter={() => {
                        if (clickable && !isInSelectedSpan) {
                          setHover({ dayIdx: d.idx, startSlotIdx: slotIdx })
                        }
                      }}
                      onMouseLeave={() => {
                        setHover((curr) =>
                          curr &&
                          curr.dayIdx === d.idx &&
                          curr.startSlotIdx === slotIdx
                            ? null
                            : curr,
                        )
                      }}
                      title={
                        isInSelectedSpan
                          ? `Clase ${spanInfo!.startTime} – ${endTimeForStart(spanInfo!.startTime)} · click para sacarla`
                          : cell
                            ? buildTitle(
                                cell,
                                false,
                                ignoreTeacher,
                                conflictName,
                                startTime,
                                endTime,
                              )
                            : ""
                      }
                      aria-pressed={isInSelectedSpan}
                      className={cn(
                        "relative border-l transition-colors",
                        // Borde superior estándar — se respeta en hora exacta y
                        // media hora, salvo dentro de un slot seleccionado donde
                        // las celdas interiores no llevan borde para parecer
                        // una sola barra continua.
                        isInSelectedSpan && !isFirstOfSlot
                          ? "border-l-teal-700/50"
                          : "border-l-border",
                        isInSelectedSpan && isFirstOfSlot && "border-t-2 border-t-teal-700",
                        !isInSelectedSpan && isHour && "border-t border-border",
                        !isInSelectedSpan &&
                          !isHour &&
                          isHalf &&
                          "border-t border-border/30",
                        // Color de fondo según estado
                        isInSelectedSpan &&
                          "bg-teal-600 text-white hover:bg-teal-700 cursor-pointer",
                        !isInSelectedSpan && cell && KIND_BG[cell.kind],
                        !cell && !isInSelectedSpan && "bg-surface",
                        // Hover-span ring (solo cuando NO hay slot ya elegido)
                        inHoverSpan &&
                          "ring-1 ring-inset ring-teal-500/60 z-10",
                      )}
                      style={{ height: `${CELL_HEIGHT_PX}px` }}
                    >
                      {isFirstOfSlot && (
                        <span className="block text-center font-mono text-[9.5px] font-semibold leading-[14px] tracking-[0.02em] text-white">
                          {spanInfo!.startTime}–{slotEndTime}
                        </span>
                      )}
                      {!isInSelectedSpan && cell?.kind === "blocked" && (
                        <X size={10} strokeWidth={1.6} className="mx-auto text-danger/60" />
                      )}
                      {/* Solo mostramos n/total cuando hay match parcial real
                         (algunos alumnos sí, algunos no). Si todos cubren o
                         nadie cubre, el color de la celda ya lo dice. */}
                      {!isInSelectedSpan &&
                        cell?.kind === "partial" &&
                        cell.studentsTotal > 1 && (
                          <span className="block text-center font-mono text-[9.5px] leading-[14px] text-warning">
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
    <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-text-3">
      <LegendItem
        swatchClass="bg-teal-500/40 border border-teal-500/50"
        label="Match — docente y todos los alumnos disponibles"
      />
      <LegendItem
        swatchClass="bg-warning/30 border border-warning/40"
        label="Match parcial — algunos alumnos no cubren (n/total)"
      />
      <LegendItem
        swatchClass="bg-info/15 border border-info/30"
        label="Solo docente disponible"
      />
      <LegendItem
        swatchClass="bg-bone-100 border border-border"
        label="Sin disponibilidad"
      />
      <LegendItem
        swatchClass="bg-danger/15 border border-danger/30"
        label="Choca con otra aula del docente"
      />
      <LegendItem
        swatchClass="bg-teal-600 border border-teal-700"
        label="Slot elegido"
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
  isSelected: boolean,
  ignoreTeacher: boolean | undefined,
  conflictName: string | undefined,
  startTime: string,
  endTime: string,
): string {
  const range = `${startTime} a ${endTime}`
  if (isSelected) return `Clase ${range} · click para sacarla`
  switch (cell.kind) {
    case "blocked":
      return `Clase ${range} · el docente ya dicta ${conflictName ?? "otra aula"} en este horario`
    case "gray":
      return `Clase ${range} · sin disponibilidad`
    case "students_only":
      return cell.studentsTotal > 0
        ? `Clase ${range} · ${cell.studentsCovered} de ${cell.studentsTotal} alumnos cubren, pero el docente no — no se puede bookear`
        : `Clase ${range} · sin disponibilidad del docente`
    case "teacher_only":
      return ignoreTeacher
        ? `Clase ${range} · docente disponible (sin alumnos seleccionados)`
        : cell.studentsTotal === 0
          ? `Clase ${range} · docente disponible. Seleccioná estudiantes para ver matches`
          : `Clase ${range} · docente disponible, pero ningún alumno cubre este horario`
    case "partial":
      return `Clase ${range} · ${cell.studentsCovered} de ${cell.studentsTotal} alumnos disponibles`
    case "match":
      return `Clase ${range} · match completo — docente y todos los alumnos disponibles`
    default:
      return ""
  }
}

function sortSlots(a: Slot, b: Slot): number {
  return a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)
}
