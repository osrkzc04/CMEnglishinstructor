import type { SlotInput } from "./schemas"

/**
 * Genera un nombre sugerido para un aula a partir del nivel y los slots.
 * Ejemplos:
 *   ProgramLevel "Time Zones 2" + slots Mar/Jue 18:00  → "TZ2 · Mar-Jue 18:00"
 *   "Market Leader Elementary" + slots Lun/Mié/Vie 19:00 → "ML · Lun-Mié-Vie 19:00"
 *   "Vistas 3" + Sáb 09:00 → "Vistas 3 · Sáb 09:00"
 *
 * El usuario puede editar el nombre después; este helper solo da una semilla
 * razonable.
 */

const DAY_LABELS: Record<number, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
}

/**
 * Abrevia el nombre del programa-level si es claramente identificable. Si no,
 * devuelve el nombre tal cual (truncado).
 */
function abbreviateLevel(programName: string, levelCode: string): string {
  const initials = programName
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .join("")
  // Si las iniciales son al menos 2 letras y el code es numérico,
  // generamos forma compacta. Si no, usamos el nombre completo del level.
  if (initials.length >= 2 && /^\d+$/.test(levelCode)) {
    return `${initials}${levelCode}`
  }
  if (initials.length >= 2) {
    return initials
  }
  return programName
}

export function generateClassGroupName(args: {
  programName: string
  levelCode: string
  levelName: string
  slots: SlotInput[]
}): string {
  const { programName, levelCode, levelName, slots } = args

  if (slots.length === 0) {
    return levelName
  }

  // Días únicos en orden Lun→Dom
  const orderedDays = [1, 2, 3, 4, 5, 6, 0]
  const daySet = new Set(slots.map((s) => s.dayOfWeek))
  const days = orderedDays.filter((d) => daySet.has(d)).map((d) => DAY_LABELS[d])

  // Hora más temprana entre los slots
  const earliest = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime))[0]?.startTime

  const head = abbreviateLevel(programName, levelCode)
  const daysLabel = days.join("-")
  return earliest ? `${head} · ${daysLabel} ${earliest}` : `${head} · ${daysLabel}`
}
