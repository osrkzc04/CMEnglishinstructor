"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { AvailabilityBlock } from "@/modules/teachers/schemas"

/**
 * Grilla semanal de disponibilidad — 06:00 a 22:00 en celdas de 15 min ×
 * 7 días. Click alterna; mantener presionado y arrastrar pinta o borra.
 *
 * Persistencia: las celdas activas se compactan en bloques `[start, end]`
 * por día y se notifican vía `onChange`. La granularidad de 15 min permite
 * configurar bloques de 15, 30, 45 o más minutos arrastrando.
 */

const SLOT_MINUTES = 15
const HOUR_CELLS = 60 / SLOT_MINUTES // 4
const START_HOUR = 6
const END_HOUR = 22
const SLOTS_PER_DAY = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES // 64
const CELL_HEIGHT_PX = 12

const DAYS: { idx: number; short: string; long: string }[] = [
  { idx: 1, short: "Lun", long: "Lunes" },
  { idx: 2, short: "Mar", long: "Martes" },
  { idx: 3, short: "Mié", long: "Miércoles" },
  { idx: 4, short: "Jue", long: "Jueves" },
  { idx: 5, short: "Vie", long: "Viernes" },
  { idx: 6, short: "Sáb", long: "Sábado" },
  { idx: 0, short: "Dom", long: "Domingo" },
]

type Props = {
  blocks: AvailabilityBlock[]
  onChange: (blocks: AvailabilityBlock[]) => void
  disabled?: boolean
}

function cellKey(day: number, slot: number): string {
  return `${day}:${slot}`
}

function slotToTime(slot: number): string {
  const m = START_HOUR * 60 + slot * SLOT_MINUTES
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

function timeToSlot(time: string): number | null {
  const parts = time.split(":")
  if (parts.length !== 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const total = h * 60 + m - START_HOUR * 60
  if (total < 0) return null
  if (total > SLOTS_PER_DAY * SLOT_MINUTES) return null
  if (total % SLOT_MINUTES !== 0) return null
  return total / SLOT_MINUTES
}

function blocksToCells(blocks: AvailabilityBlock[]): Set<string> {
  const set = new Set<string>()
  for (const b of blocks) {
    const startSlot = timeToSlot(b.startTime)
    const endSlot = timeToSlot(b.endTime)
    if (startSlot === null || endSlot === null) continue
    for (let s = startSlot; s < endSlot; s++) {
      set.add(cellKey(b.dayOfWeek, s))
    }
  }
  return set
}

function cellsToBlocks(cells: Set<string>): AvailabilityBlock[] {
  const byDay = new Map<number, number[]>()
  for (const k of cells) {
    const parts = k.split(":")
    const d = Number(parts[0])
    const s = Number(parts[1])
    const list = byDay.get(d) ?? []
    list.push(s)
    byDay.set(d, list)
  }
  const blocks: AvailabilityBlock[] = []
  for (const [day, slots] of byDay) {
    if (slots.length === 0) continue
    slots.sort((a, b) => a - b)
    let runStart = slots[0]!
    let prev = slots[0]!
    for (let i = 1; i < slots.length; i++) {
      const s = slots[i]!
      if (s === prev + 1) {
        prev = s
      } else {
        blocks.push({
          dayOfWeek: day,
          startTime: slotToTime(runStart),
          endTime: slotToTime(prev + 1),
        })
        runStart = s
        prev = s
      }
    }
    blocks.push({
      dayOfWeek: day,
      startTime: slotToTime(runStart),
      endTime: slotToTime(prev + 1),
    })
  }
  blocks.sort(
    (a, b) =>
      a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
  )
  return blocks
}

function cellsKey(cells: Set<string>): string {
  return Array.from(cells).sort().join("|")
}

export function AvailabilityGrid({ blocks, onChange, disabled }: Props) {
  const [cells, setCells] = useState<Set<string>>(() => blocksToCells(blocks))
  const cellsRef = useRef(cells)
  cellsRef.current = cells

  const incomingKey = useMemo(() => cellsKey(blocksToCells(blocks)), [blocks])
  const lastSyncedKey = useRef(incomingKey)
  useEffect(() => {
    if (incomingKey !== lastSyncedKey.current) {
      lastSyncedKey.current = incomingKey
      const next = blocksToCells(blocks)
      if (cellsKey(next) !== cellsKey(cellsRef.current)) {
        setCells(next)
      }
    }
  }, [incomingKey, blocks])

  const [dragMode, setDragMode] = useState<"add" | "remove" | null>(null)
  const pointerActiveRef = useRef(false)

  function commit(next: Set<string>) {
    setCells(next)
    cellsRef.current = next
    const nextBlocks = cellsToBlocks(next)
    lastSyncedKey.current = cellsKey(next)
    onChange(nextBlocks)
  }

  function applyTo(day: number, slot: number, mode: "add" | "remove") {
    const key = cellKey(day, slot)
    const next = new Set(cellsRef.current)
    const has = next.has(key)
    if (mode === "add" && !has) {
      next.add(key)
      commit(next)
    } else if (mode === "remove" && has) {
      next.delete(key)
      commit(next)
    }
  }

  function startDrag(day: number, slot: number) {
    if (disabled) return
    const has = cellsRef.current.has(cellKey(day, slot))
    const mode: "add" | "remove" = has ? "remove" : "add"
    setDragMode(mode)
    applyTo(day, slot, mode)
  }

  function dragOver(day: number, slot: number) {
    if (!dragMode) return
    applyTo(day, slot, dragMode)
  }

  function toggleSingle(day: number, slot: number) {
    if (disabled) return
    const has = cellsRef.current.has(cellKey(day, slot))
    applyTo(day, slot, has ? "remove" : "add")
  }

  useEffect(() => {
    if (!dragMode) return
    function up() {
      setDragMode(null)
    }
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
    return () => {
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
    }
  }, [dragMode])

  return (
    <div className="select-none">
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {/* Header de días */}
        <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-border bg-surface-alt">
          <div />
          {DAYS.map((d) => (
            <div
              key={d.idx}
              className="border-l border-border px-2 py-2 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-text-3"
            >
              {d.short}
            </div>
          ))}
        </div>

        {/* Cuerpo de la grilla */}
        <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))]">
          {Array.from({ length: SLOTS_PER_DAY }).map((_, slot) => {
            const isHour = slot % HOUR_CELLS === 0
            const isHalf = slot % HOUR_CELLS === HOUR_CELLS / 2
            const topBorder = isHour
              ? "border-t border-border"
              : isHalf
                ? "border-t border-border/40"
                : ""
            return (
              <Fragment key={slot}>
                <div
                  className={cn(
                    "flex items-start justify-end pr-2 font-mono tracking-[0.02em]",
                    isHour
                      ? "border-t border-border text-[10.5px] text-text-3"
                      : isHalf
                        ? "text-[10px] text-text-4"
                        : "text-text-4",
                  )}
                  style={{ height: `${CELL_HEIGHT_PX}px`, lineHeight: `${CELL_HEIGHT_PX}px` }}
                >
                  {isHour || isHalf ? slotToTime(slot) : ""}
                </div>
                {DAYS.map((d) => {
                  const key = cellKey(d.idx, slot)
                  const active = cells.has(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled}
                      data-cell={key}
                      aria-label={`${d.long} ${slotToTime(slot)} a ${slotToTime(slot + 1)}`}
                      aria-pressed={active}
                      onPointerDown={(e) => {
                        if (disabled) return
                        e.preventDefault()
                        pointerActiveRef.current = true
                        startDrag(d.idx, slot)
                      }}
                      onPointerEnter={() => dragOver(d.idx, slot)}
                      onClick={() => {
                        if (pointerActiveRef.current) {
                          pointerActiveRef.current = false
                          return
                        }
                        toggleSingle(d.idx, slot)
                      }}
                      style={{ height: `${CELL_HEIGHT_PX}px` }}
                      className={cn(
                        "block w-full border-l border-border transition-colors",
                        topBorder,
                        active
                          ? "bg-teal-500/[0.18] hover:bg-teal-500/[0.28]"
                          : "bg-surface hover:bg-surface-alt",
                        "focus:outline-none focus-visible:relative focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-teal-500/60",
                        disabled && "cursor-not-allowed opacity-60 hover:bg-surface",
                      )}
                    />
                  )
                })}
              </Fragment>
            )
          })}
        </div>

        {/* Cierre con la hora final */}
        <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-t border-border bg-surface-alt">
          <div className="flex items-center justify-end pr-2 py-1 font-mono text-[10.5px] tracking-[0.02em] text-text-4">
            {slotToTime(SLOTS_PER_DAY)}
          </div>
          {DAYS.map((d) => (
            <div key={`closer-${d.idx}`} className="border-l border-border" />
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-text-3">
          Click o arrastrá sobre la grilla para marcar bloques disponibles.
        </p>
        {cells.size > 0 && (
          <p className="font-mono text-[11px] tracking-[0.02em] text-text-3">
            {formatTotalHours(cells)} h por semana
          </p>
        )}
      </div>
    </div>
  )
}

function formatTotalHours(cells: Set<string>): string {
  const totalMinutes = cells.size * SLOT_MINUTES
  const h = totalMinutes / 60
  if (Number.isInteger(h)) return String(h)
  return h.toFixed(2).replace(/\.?0+$/, "")
}
