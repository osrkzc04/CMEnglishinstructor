/**
 * Recomendación de nivel CEFR al cerrar la revisión del placement.
 *
 * Función pura (sin I/O ni `server-only`) para usarla tanto en el servidor
 * como en el formulario de revisión, que la recalcula en vivo mientras
 * coordinación ingresa las notas.
 *
 * La regla, conversada con coordinación:
 *
 *  1. El bloque más alto que el candidato superó en el examen adaptativo
 *     (es decir, la sección con mayor `sectionOrder` cuyo `passedThreshold`
 *     es `true`) marca el nivel al que "llegó".
 *  2. Para confirmar ese nivel, el puntaje total (Reading/Grammar + Writing
 *     + Listening + Speaking, sobre 400) debe alcanzar el umbral global
 *     (`placement_confirmation_threshold_percent`, default 78%).
 *  3. Por debajo del umbral, la recomendación baja un nivel respecto al
 *     alcanzado (si no hay nivel inferior, queda sin recomendación).
 *  4. Si el candidato no superó ningún bloque, no hay recomendación —
 *     coordinación decide caso por caso.
 *
 * Es solo una sugerencia: el `assignedLevelId` final lo decide coordinación.
 */

export const PLACEMENT_TOTAL_MAX = 400
export const PLACEMENT_SKILL_MAX = 100

export type CefrLevelLite = {
  id: string
  code: string
  name: string
  order: number
}

export type PlacementSectionSummary = {
  sectionOrder: number
  cefrLevelCode: string
  passedThreshold: boolean
}

export type PlacementRecommendation = {
  /** Code del nivel más alto que el candidato superó en el adaptativo. */
  reachedCode: string | null
  /** Nivel sugerido tras aplicar el umbral. `null` si no hay candidato claro. */
  recommendedLevel: CefrLevelLite | null
  /** Porcentaje del puntaje total (0-100), redondeado. */
  totalPercent: number
  /** Umbral configurado (0-100). */
  thresholdPercent: number
  /** `true` si el total queda por debajo del umbral. */
  isBelowThreshold: boolean
}

export function recommendPlacementLevel(args: {
  sectionSummaries: PlacementSectionSummary[]
  total: number
  thresholdPercent: number
  cefrLevels: CefrLevelLite[]
}): PlacementRecommendation {
  const { sectionSummaries, total, thresholdPercent, cefrLevels } = args

  const totalPercent = Math.round((total / PLACEMENT_TOTAL_MAX) * 100)
  const isBelowThreshold = totalPercent < thresholdPercent

  const passed = sectionSummaries
    .filter((s) => s.passedThreshold)
    .sort((a, b) => b.sectionOrder - a.sectionOrder)
  const reached = passed[0] ?? null
  const reachedCode = reached?.cefrLevelCode ?? null

  if (!reached) {
    return { reachedCode, recommendedLevel: null, totalPercent, thresholdPercent, isBelowThreshold }
  }

  const reachedLevel = cefrLevels.find((l) => l.code === reached.cefrLevelCode) ?? null
  if (!reachedLevel) {
    return { reachedCode, recommendedLevel: null, totalPercent, thresholdPercent, isBelowThreshold }
  }

  if (!isBelowThreshold) {
    return {
      reachedCode,
      recommendedLevel: reachedLevel,
      totalPercent,
      thresholdPercent,
      isBelowThreshold,
    }
  }

  const downLevel = cefrLevels.find((l) => l.order === reachedLevel.order - 1) ?? null
  return {
    reachedCode,
    recommendedLevel: downLevel,
    totalPercent,
    thresholdPercent,
    isBelowThreshold,
  }
}
