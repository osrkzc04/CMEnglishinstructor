/**
 * Cruce de disponibilidades — núcleo del flujo 04 (asignación de docente).
 *
 * Función pura, sin Prisma, sin red. Recibe dos listas de slots semanales
 * recurrentes (formato HH:mm sin zona) y devuelve las ventanas de
 * intersección por día que tengan al menos `minDurationMinutes` de duración.
 *
 * Las horas se asumen en la misma zona horaria (`America/Guayaquil` por
 * convención del proyecto). El consumidor es responsable de convertir a UTC
 * cuando materialice una sesión a fecha concreta.
 */

export type Slot = {
  dayOfWeek: number // 0=Domingo … 6=Sábado
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
}

export type SlotWindow = Slot & {
  durationMinutes: number
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function timeToMinutes(t: string): number {
  if (!TIME_RE.test(t)) throw new Error(`Hora inválida: ${t}`)
  const [h, m] = t.split(":").map(Number) as [number, number]
  return h * 60 + m
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * Intersecta dos conjuntos de slots semanales. Devuelve, por día y orden,
 * las ventanas que cumplen `minDurationMinutes`. Si dos ventanas del mismo
 * día se tocan o solapan, se fusionan en una sola — esto evita "ruido" en
 * la UI cuando el docente o el estudiante tienen bloques contiguos.
 */
export function intersectSchedules(a: Slot[], b: Slot[], minDurationMinutes: number): SlotWindow[] {
  const raw: SlotWindow[] = []
  for (const sa of a) {
    for (const sb of b) {
      if (sa.dayOfWeek !== sb.dayOfWeek) continue
      const startMin = Math.max(timeToMinutes(sa.startTime), timeToMinutes(sb.startTime))
      const endMin = Math.min(timeToMinutes(sa.endTime), timeToMinutes(sb.endTime))
      const duration = endMin - startMin
      if (duration >= minDurationMinutes) {
        raw.push({
          dayOfWeek: sa.dayOfWeek,
          startTime: minutesToTime(startMin),
          endTime: minutesToTime(endMin),
          durationMinutes: duration,
        })
      }
    }
  }
  return mergeAdjacent(raw, minDurationMinutes)
}

/**
 * Fusiona ventanas adyacentes/solapadas dentro del mismo día. Mantiene el
 * filtro por duración mínima por si la fusión hubiera producido una
 * ventana corta (no debería ocurrir si el input ya estaba filtrado, pero es
 * defensivo).
 */
function mergeAdjacent(windows: SlotWindow[], minDurationMinutes: number): SlotWindow[] {
  const byDay = new Map<number, SlotWindow[]>()
  for (const w of windows) {
    const list = byDay.get(w.dayOfWeek) ?? []
    list.push(w)
    byDay.set(w.dayOfWeek, list)
  }

  const out: SlotWindow[] = []
  for (const [day, list] of byDay) {
    list.sort((x, y) => timeToMinutes(x.startTime) - timeToMinutes(y.startTime))
    let current: { start: number; end: number } | null = null
    for (const w of list) {
      const start = timeToMinutes(w.startTime)
      const end = timeToMinutes(w.endTime)
      if (!current) {
        current = { start, end }
        continue
      }
      if (start <= current.end) {
        current.end = Math.max(current.end, end)
      } else {
        pushWindow(out, day, current, minDurationMinutes)
        current = { start, end }
      }
    }
    if (current) pushWindow(out, day, current, minDurationMinutes)
  }
  out.sort(
    (x, y) => x.dayOfWeek - y.dayOfWeek || timeToMinutes(x.startTime) - timeToMinutes(y.startTime),
  )
  return out
}

function pushWindow(
  out: SlotWindow[],
  day: number,
  range: { start: number; end: number },
  minDurationMinutes: number,
) {
  const duration = range.end - range.start
  if (duration < minDurationMinutes) return
  out.push({
    dayOfWeek: day,
    startTime: minutesToTime(range.start),
    endTime: minutesToTime(range.end),
    durationMinutes: duration,
  })
}

/**
 * Genera las opciones de inicio de clase dentro de una ventana, deslizando
 * en pasos de `stepMinutes` (default 15). La última opción encaja la clase
 * justo al final. Útil cuando una ventana es más larga que `classDuration`
 * y el coordinador puede elegir a qué hora arrancar.
 */
export function buildLessonStarts(
  window: SlotWindow,
  classDurationMinutes: number,
  stepMinutes = 15,
): { startTime: string; endTime: string }[] {
  const starts: { startTime: string; endTime: string }[] = []
  const winStart = timeToMinutes(window.startTime)
  const winEnd = timeToMinutes(window.endTime)
  for (let s = winStart; s + classDurationMinutes <= winEnd; s += stepMinutes) {
    starts.push({
      startTime: minutesToTime(s),
      endTime: minutesToTime(s + classDurationMinutes),
    })
  }
  return starts
}
