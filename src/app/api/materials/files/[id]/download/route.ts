import { NextResponse } from "next/server"
import { Readable } from "node:stream"
import { prisma } from "@/lib/prisma"
import { requireAuth, UnauthorizedError } from "@/modules/auth/guards"
import { storage } from "@/lib/storage"
import { canAccessProgramLevel } from "@/modules/materials/access"

/**
 * Descarga (stream) de un archivo de materiales con verificación de acceso
 * según el rol del usuario.
 *
 *   GET /api/materials/files/<id>/download[?inline=1]
 *
 * Por defecto fuerza `Content-Disposition: attachment` (descarga). Con
 * `?inline=1` lo deja inline para que el navegador previsualice PDFs/imágenes
 * — útil cuando exponemos preview en la UI.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth({ redirectTo: "throw" })
    const { id } = await params

    const file = await prisma.materialFile.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        size: true,
        mimeType: true,
        storageKey: true,
        deletedAt: true,
        folder: { select: { programLevelId: true } },
      },
    })
    if (!file || file.deletedAt) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 })
    }

    if (!user.role) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 403 })
    }
    const allowed = await canAccessProgramLevel(user.id, user.role, file.folder.programLevelId)
    if (!allowed) {
      return NextResponse.json({ error: "Sin acceso a este material" }, { status: 403 })
    }

    const { stream, size } = await storage().getReadStream(file.storageKey)

    const url = new URL(req.url)
    const inline = url.searchParams.get("inline") === "1"
    const disposition = inline ? "inline" : "attachment"

    // RFC 5987 — soporta nombres con caracteres no-ASCII.
    const encoded = encodeURIComponent(file.name)

    const webStream = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>
    return new Response(webStream, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Length": String(size),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encoded}`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }
    console.error("[materials/download] error:", err)
    return NextResponse.json({ error: "Falla al descargar" }, { status: 500 })
  }
}
