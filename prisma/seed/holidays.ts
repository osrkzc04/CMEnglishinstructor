import { PrismaClient } from "@prisma/client"

/**
 * Feriados de Ecuador del año en curso (ajustables vía UI). El listado
 * embebido es de referencia; coordinación debería revisarlo y agregar los
 * feriados específicos del calendario académico.
 */
export async function seedHolidays(prisma: PrismaClient, createdBy: string): Promise<void> {
  // Lista para 2026 — fuente: Ministerio de Trabajo (consulta general).
  const holidays = [
    { date: "2026-01-01", name: "Año Nuevo" },
    { date: "2026-02-16", name: "Carnaval" },
    { date: "2026-02-17", name: "Carnaval" },
    { date: "2026-04-03", name: "Viernes Santo" },
    { date: "2026-05-01", name: "Día del Trabajo" },
    { date: "2026-05-24", name: "Batalla de Pichincha" },
    { date: "2026-08-10", name: "Primer Grito de Independencia" },
    { date: "2026-10-09", name: "Independencia de Guayaquil" },
    { date: "2026-11-02", name: "Día de los Difuntos" },
    { date: "2026-11-03", name: "Independencia de Cuenca" },
    { date: "2026-12-25", name: "Navidad" },
  ]
  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { date_name: { date: new Date(h.date), name: h.name } },
      update: {},
      create: { date: new Date(h.date), name: h.name, createdBy },
    })
  }
}
