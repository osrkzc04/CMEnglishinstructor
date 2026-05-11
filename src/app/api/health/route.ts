import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Healthcheck para Docker / Dokploy / monitoreo externo.
 *
 * Devuelve 200 + `{ ok: true, db: "up" }` si la conexión a la base responde
 * un `SELECT 1`. Si la query falla, responde 503 con el detalle del error
 * (sin filtrar credenciales — Prisma ya las redacta de su lado).
 *
 * No-cache: el orquestador llama por curl, no por CDN.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json(
      { ok: true, db: "up", at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        error: err instanceof Error ? err.message : String(err),
        at: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
