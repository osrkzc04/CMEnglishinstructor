import "server-only"
import { cache } from "react"
import { SettingType } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Lectura/escritura de `AppSetting`. Las claves vienen tipadas vía un
 * registry — agregar una nueva acá obliga a documentar tipo y default.
 *
 * `getSetting` cachea por request (React cache). Si una action escribe un
 * setting, el siguiente render del request actual ya tiene el valor nuevo
 * porque pasamos por la cache nueva (Next limpia entre requests).
 *
 * Convención de naming: snake_case con scope al inicio (`weekly.min_hours`,
 * `attendance.absence_counts_as_consumed`).
 */

// -----------------------------------------------------------------------------
//  Registry de settings conocidos — agregar nuevos acá
// -----------------------------------------------------------------------------

type SettingDef<T> = {
  key: string
  type: SettingType
  default: T
  description: string
}

// Los defaults se anotan explícitamente con `as number`/`as boolean` para
// que el tipo de retorno de `getSetting`/`setSetting` sea el primitivo
// ancho (`number`/`boolean`) y no la literal del valor inicial. Sin esto,
// `default: false` se infiere como literal `false` y el call site no
// puede pasar un `boolean` arbitrario.
const SETTINGS = {
  weeklyMinHours: {
    key: "min_weekly_hours",
    type: SettingType.NUMBER,
    default: 2 as number,
    description: "Mínimo de horas semanales por aula.",
  } satisfies SettingDef<number>,
  weeklyMaxHours: {
    key: "max_weekly_hours",
    type: SettingType.NUMBER,
    default: 10 as number,
    description: "Máximo de horas semanales por aula.",
  } satisfies SettingDef<number>,
  absenceCountsAsConsumed: {
    key: "absence_counts_as_consumed",
    type: SettingType.BOOLEAN,
    default: false as boolean,
    description: "Si una ausencia (ABSENT) cuenta como hora consumida del estudiante.",
  } satisfies SettingDef<boolean>,
  classDefaultDurationMinutes: {
    key: "class_default_duration_minutes",
    type: SettingType.NUMBER,
    default: 60 as number,
    description:
      "Duración por defecto (en minutos) de una clase. Se usa como valor inicial al crear un Course nuevo y como referencia editable desde el panel de configuración. Las aulas existentes mantienen su snapshot original — cambiar este valor no altera horarios ya planificados.",
  } satisfies SettingDef<number>,
} as const

export type SettingKey = keyof typeof SETTINGS

// -----------------------------------------------------------------------------
//  API pública
// -----------------------------------------------------------------------------

export const getSetting = cache(
  async <K extends SettingKey>(key: K): Promise<(typeof SETTINGS)[K]["default"]> => {
    const def = SETTINGS[key]
    const row = await prisma.appSetting.findUnique({
      where: { key: def.key },
      select: { value: true, type: true },
    })
    if (!row) return def.default
    return parseValue(row.value, row.type, def.default) as (typeof SETTINGS)[K]["default"]
  },
)

/** Lee múltiples settings en paralelo. */
export async function getSettings<K extends SettingKey>(
  keys: K[],
): Promise<{ [P in K]: (typeof SETTINGS)[P]["default"] }> {
  const entries = await Promise.all(keys.map(async (k) => [k, await getSetting(k)] as const))
  return Object.fromEntries(entries) as {
    [P in K]: (typeof SETTINGS)[P]["default"]
  }
}

/**
 * Upsert de un setting. Convierte el valor a string según el tipo y respeta
 * los defaults del registry.
 */
export async function setSetting<K extends SettingKey>(
  key: K,
  value: (typeof SETTINGS)[K]["default"],
  updatedBy?: string,
): Promise<void> {
  const def = SETTINGS[key]
  const stringified = stringifyValue(value, def.type)
  await prisma.appSetting.upsert({
    where: { key: def.key },
    create: {
      key: def.key,
      value: stringified,
      type: def.type,
      description: def.description,
      updatedBy: updatedBy ?? null,
    },
    update: {
      value: stringified,
      type: def.type,
      updatedBy: updatedBy ?? null,
    },
  })
}

/** Devuelve la metadata del setting — útil para describirlo en la UI. */
export function getSettingMeta<K extends SettingKey>(
  key: K,
): { key: string; type: SettingType; description: string } {
  const def = SETTINGS[key]
  return { key: def.key, type: def.type, description: def.description }
}

// -----------------------------------------------------------------------------
//  Helpers
// -----------------------------------------------------------------------------

function parseValue(raw: string, type: SettingType, fallback: unknown): unknown {
  try {
    switch (type) {
      case SettingType.NUMBER: {
        const n = Number(raw)
        return Number.isFinite(n) ? n : fallback
      }
      case SettingType.BOOLEAN:
        return raw === "true"
      case SettingType.JSON:
        return JSON.parse(raw)
      case SettingType.STRING:
      default:
        return raw
    }
  } catch {
    return fallback
  }
}

function stringifyValue(value: unknown, type: SettingType): string {
  switch (type) {
    case SettingType.JSON:
      return JSON.stringify(value)
    case SettingType.BOOLEAN:
      return value ? "true" : "false"
    case SettingType.NUMBER:
    case SettingType.STRING:
    default:
      return String(value)
  }
}
