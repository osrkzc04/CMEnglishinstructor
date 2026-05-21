import type { SlotInput } from "./schemas"

/**
 * Genera un nombre sugerido para un aula a partir del nivel y los slots.
 *
 * Hay dos formas dependiendo de cuántos estudiantes tenga el aula:
 *
 *   - **1 estudiante** (clase 1-a-1): `"Nivel.Apellido"`. El nivel se abrevia
 *     igual que en el caso grupal ("Time Zones 2" → "TZ2"). El apellido es el
 *     del único estudiante asignado al aula.
 *     Ejemplo: `"TZ2.Pérez"`.
 *
 *   - **Grupos (2+)** o **placeholder sin estudiantes**: el nombre se compone
 *     del nivel abreviado, los días de la semana y la hora más temprana.
 *     Ejemplos:
 *       "Time Zones 2" + slots Mar/Jue 18:00         → "TZ2 · Mar-Jue 18:00"
 *       "Market Leader Elementary" + Lun/Mié/Vie 19h → "ML · Lun-Mié-Vie 19:00"
 *       "Vistas 3" + Sáb 09:00                       → "Vistas 3 · Sáb 09:00"
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
  /**
   * Si el aula tiene exactamente UN estudiante, se pasa su apellido para
   * generar el nombre como `"NivelAbreviado.Apellido"`. Para grupos (o sin
   * estudiantes) se omite y el nombre vuelve al patrón con días/horario.
   */
  studentLastName?: string | null
}): string {
  const { programName, levelCode, levelName, slots, studentLastName } = args

  const head = abbreviateLevel(programName, levelCode)

  // Clase 1-a-1: nombre por apellido, sin importar slots.
  const trimmedLastName = studentLastName?.trim() ?? ""
  if (trimmedLastName.length > 0) {
    return `${head}.${trimmedLastName}`
  }

  if (slots.length === 0) {
    return levelName
  }

  // Días únicos en orden Lun→Dom
  const orderedDays = [1, 2, 3, 4, 5, 6, 0]
  const daySet = new Set(slots.map((s) => s.dayOfWeek))
  const days = orderedDays.filter((d) => daySet.has(d)).map((d) => DAY_LABELS[d])

  // Hora más temprana entre los slots
  const earliest = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime))[0]?.startTime

  const daysLabel = days.join("-")
  return earliest ? `${head} · ${daysLabel} ${earliest}` : `${head} · ${daysLabel}`
}
