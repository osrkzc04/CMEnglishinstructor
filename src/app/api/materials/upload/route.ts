import { NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { requireRole, ForbiddenError, UnauthorizedError } from "@/modules/auth/guards"
import { storage } from "@/lib/storage"
import { NameSchema } from "@/modules/materials/schemas"
import { findFileByNameInFolder } from "@/modules/materials/queries"

/**
 * Upload de archivos al repositorio de materiales.
 *
 * Protocolo: PUT-like binario (no multipart). El cliente envía el cuerpo
 * crudo del archivo y los metadatos van por query params:
 *   POST /api/materials/upload?folderId=cuid&name=curso.zip
 *   Content-Type: application/zip
 *   Content-Length: <bytes>     (opcional, informativo)
 *   <body>                      (binary file content)
 *
 * Por qué no multipart: para archivos >10GB el parser tradicional bufferea
 * o copia partes a /tmp; el binario directo se pipe-ea sin tocar memoria.
 *
 * Límites: el body size lo controla el reverse proxy (nginx
 * `client_max_body_size 0;`). Desde Node/Next no hay tope hard-coded para
 * `request.body` (ReadableStream).
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Sin `maxDuration` — en self-host depende del proxy. Vercel cortaría a 60s
// para Hobby, así que estos uploads grandes solo viven en VPS/cPanel.

export async function POST(req: Request) {
  try {
    const user = await requireRole(["DIRECTOR", "COORDINATOR"])

    const url = new URL(req.url)
    const folderId = url.searchParams.get("folderId")
    const rawName = url.searchParams.get("name")

    if (!folderId) return NextResponse.json({ error: "folderId requerido" }, { status: 400 })
    if (!rawName) return NextResponse.json({ error: "name requerido" }, { status: 400 })

    const nameResult = NameSchema.safeParse(rawName)
    if (!nameResult.success) {
      return NextResponse.json(
        { error: nameResult.error.issues[0]?.message ?? "Nombre inválido" },
        { status: 400 },
      )
    }
    const name = nameResult.data

    const folder = await prisma.materialFolder.findUnique({
      where: { id: folderId },
      select: { id: true, deletedAt: true },
    })
    if (!folder || folder.deletedAt) {
      return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 })
    }

    const conflict = await findFileByNameInFolder(folder.id, name)
    if (conflict) {
      return NextResponse.json({ error: "Ya existe un archivo con ese nombre" }, { status: 409 })
    }

    if (!req.body) return NextResponse.json({ error: "Body vacío" }, { status: 400 })

    // Key del storage: prefijo por carpeta + sufijo random para evitar
    // colisiones si dos archivos comparten nombre tras un rename.
    const suffix = randomBytes(8).toString("hex")
    const safeName = name.replace(/[^\w.\-()\s]/g, "_")
    const storageKey = `materials/${folder.id}/${suffix}_${safeName}`

    const contentType = req.headers.get("content-type") ?? "application/octet-stream"

    const { size } = await storage().uploadStream(storageKey, req.body, { contentType })

    const file = await prisma.materialFile.create({
      data: {
        folderId: folder.id,
        name,
        storageKey,
        size: BigInt(size),
        mimeType: contentType,
        uploadedById: user.id,
      },
      select: { id: true, name: true, size: true, mimeType: true, uploadedAt: true },
    })

    return NextResponse.json({
      id: file.id,
      name: file.name,
      size: file.size.toString(),
      mimeType: file.mimeType,
      uploadedAt: file.uploadedAt,
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    console.error("[materials/upload] error:", err)
    return NextResponse.json({ error: "Falla al subir el archivo" }, { status: 500 })
  }
}
