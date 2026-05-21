import { NextResponse } from "next/server"
import { requireRole } from "@/modules/auth/guards"
import { buildCsvTemplate } from "@/modules/questions/import"

/**
 * Descarga del CSV de ejemplo para el banco de preguntas.
 *
 *   GET /api/questions/csv-template?level=A1
 *
 * Devuelve un archivo `banco-preguntas-A1.csv` con headers + dos filas de
 * ejemplo (una MC y una FILL). El navegador lo abre como descarga gracias al
 * Content-Disposition.
 */

export async function GET(request: Request) {
  await requireRole(["DIRECTOR", "COORDINATOR"])

  const url = new URL(request.url)
  const levelRaw = url.searchParams.get("level")
  const level =
    levelRaw && /^[A-Za-z][0-9A-Za-z]{0,4}$/.test(levelRaw) ? levelRaw.toUpperCase() : "A1"

  const csv = buildCsvTemplate(level)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="banco-preguntas-${level}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
