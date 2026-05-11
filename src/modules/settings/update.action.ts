"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/modules/auth/guards"
import { setSetting } from "./index"
import { SystemSettingsSchema, type SystemSettingsInput } from "./schemas"

/**
 * Action invocada desde el form de `/admin/configuracion/sistema`. Persiste
 * los settings globales que afectan reglas de negocio del producto.
 *
 * Autorización: DIRECTOR y COORDINATOR. Los settings impactan a aulas y
 * matrículas creadas de aquí en adelante; coordinación los toca a diario,
 * dirección los firma. Si más adelante alguno de los settings es
 * sensible (ej. tarifas), filtrarlo a DIRECTOR-only en este lugar.
 *
 * Validación cruzada: weeklyMaxHours ≥ weeklyMinHours. No se hace en el
 * Zod schema porque depende de ambos campos juntos y queda más claro acá.
 *
 * Side effect: revalida el path de la página de sistema para que la
 * próxima carga muestre los valores nuevos sin caché.
 */

type Result =
  | { success: true }
  | {
      success: false
      error: string
      field?: keyof SystemSettingsInput
    }

export async function updateSystemSettings(input: SystemSettingsInput): Promise<Result> {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])

  const parsed = SystemSettingsSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0] as keyof SystemSettingsInput | undefined
    return {
      success: false,
      error: issue?.message ?? "Datos inválidos",
      field,
    }
  }
  const data = parsed.data

  if (data.weeklyMaxHours < data.weeklyMinHours) {
    return {
      success: false,
      error: "El máximo semanal no puede ser menor al mínimo",
      field: "weeklyMaxHours",
    }
  }

  await Promise.all([
    setSetting("classDefaultDurationMinutes", data.classDefaultDurationMinutes, user.id),
    setSetting("weeklyMinHours", data.weeklyMinHours, user.id),
    setSetting("weeklyMaxHours", data.weeklyMaxHours, user.id),
    setSetting("absenceCountsAsConsumed", data.absenceCountsAsConsumed, user.id),
  ])

  revalidatePath("/admin/configuracion/sistema")
  return { success: true }
}
