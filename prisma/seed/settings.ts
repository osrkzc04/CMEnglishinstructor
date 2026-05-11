import { PrismaClient, SettingType } from "@prisma/client"

/**
 * Configuración global por defecto. Idempotente: `upsert` con `update: {}`
 * deja los valores ya cargados sin tocar. Para cambiar un valor pasado el
 * primer arranque hay que hacerlo desde la UI de configuración.
 */
export async function seedSettings(
  prisma: PrismaClient,
  updatedBy: string,
): Promise<void> {
  const settings: Array<{
    key: string
    value: string
    type: SettingType
    category: string
    description: string
  }> = [
    { key: "default_class_duration_minutes",   value: "45",     type: SettingType.NUMBER,  category: "classes",       description: "Duración por defecto de una clase en minutos." },
    { key: "default_price_per_hour",           value: "25",     type: SettingType.NUMBER,  category: "classes",       description: "Costo por hora por defecto para nuevos cursos." },
    { key: "invite_token_expiration_hours",    value: "24",     type: SettingType.NUMBER,  category: "tests",         description: "Horas de validez del link de invitación a prueba." },
    { key: "candidate_can_view_results",       value: "false",  type: SettingType.BOOLEAN, category: "tests",         description: "Si el candidato puede ver su resultado luego de rendir la prueba." },
    { key: "candidate_result_detail_level",    value: "none",   type: SettingType.STRING,  category: "tests",         description: "Nivel de detalle visible al candidato: none | score_only | full." },
    { key: "absence_counts_as_consumed",       value: "false",  type: SettingType.BOOLEAN, category: "classes",       description: "Si la ausencia del estudiante consume horas contratadas." },
    { key: "min_weekly_hours",                 value: "2",      type: SettingType.NUMBER,  category: "classes",       description: "Mínimo de horas semanales que puede tener un aula." },
    { key: "max_weekly_hours",                 value: "10",     type: SettingType.NUMBER,  category: "classes",       description: "Máximo de horas semanales que puede tener un aula." },
    { key: "notification_weekly_schedule_day", value: "sunday", type: SettingType.STRING,  category: "notifications", description: "Día para enviar cronograma semanal." },
    { key: "notification_weekly_schedule_hour", value: "18",    type: SettingType.NUMBER,  category: "notifications", description: "Hora para enviar cronograma semanal (0-23)." },
    { key: "reminder_class_hours_before",      value: "2",      type: SettingType.NUMBER,  category: "notifications", description: "Horas antes de una clase para enviar recordatorio." },
    { key: "log_edit_window_hours",            value: "24",     type: SettingType.NUMBER,  category: "classes",       description: "Ventana en horas para editar bitácora después de cerrar clase." },
  ]

  for (const s of settings) {
    await prisma.appSetting.upsert({
      where: { key: s.key },
      update: {},
      create: { ...s, updatedBy },
    })
  }
}
