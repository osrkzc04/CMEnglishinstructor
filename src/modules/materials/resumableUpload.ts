import "server-only"
import { randomBytes } from "node:crypto"
import type { Readable } from "node:stream"
import { prisma } from "@/lib/prisma"
import { storage } from "@/lib/storage"
import { findFileByNameInFolder } from "./queries"
import { UPLOAD_CHUNK_SIZE } from "./schemas"

/**
 * Subida por chunks reanudable para archivos pesados (instaladores de cursos de
 * varios GB). El navegador parte el archivo y sube trozos chicos; cada uno se
 * anexa al blob temporal en storage. Al completar, el temporal se promueve al
 * key final y se materializa como `MaterialFile`.
 *
 * Flujo: createSession -> N x appendChunk -> completeSession.
 * Ver route handlers en `src/app/api/materials/upload/session/`.
 *
 * Las funciones devuelven un resultado discriminado con `status` HTTP para que
 * el route handler mapee sin conocer la lógica de negocio.
 */

type Fail = { ok: false; status: number; error: string; offset?: number }
type Ok<T> = { ok: true } & T

const fail = (status: number, error: string, offset?: number): Fail => ({
  ok: false,
  status,
  error,
  offset,
})

/** Key final del blob, con sufijo random (mismo patrón que el upload single-shot). */
function finalStorageKey(folderId: string, name: string): string {
  const suffix = randomBytes(8).toString("hex")
  const safeName = name.replace(/[^\w.\-()\s]/g, "_")
  return `materials/${folderId}/${suffix}_${safeName}`
}

// -----------------------------------------------------------------------------
//  createSession
// -----------------------------------------------------------------------------

export async function createSession(input: {
  folderId: string
  name: string
  size: number
  mimeType: string
  userId: string
}): Promise<Ok<{ uploadId: string; offset: number; chunkSize: number }> | Fail> {
  const folder = await prisma.materialFolder.findUnique({
    where: { id: input.folderId },
    select: { id: true, deletedAt: true },
  })
  if (!folder || folder.deletedAt) return fail(404, "Carpeta no encontrada")

  const conflict = await findFileByNameInFolder(folder.id, input.name)
  if (conflict) return fail(409, "Ya existe un archivo con ese nombre")

  const id = randomBytes(16).toString("hex")
  const tempKey = `tmp/uploads/${id}`

  const session = await prisma.materialUpload.create({
    data: {
      folderId: folder.id,
      name: input.name,
      mimeType: input.mimeType,
      totalSize: BigInt(input.size),
      tempKey,
      createdById: input.userId,
    },
    select: { id: true },
  })

  return { ok: true, uploadId: session.id, offset: 0, chunkSize: UPLOAD_CHUNK_SIZE }
}

// -----------------------------------------------------------------------------
//  getSession — offset para reanudar
// -----------------------------------------------------------------------------

export async function getSession(
  uploadId: string,
): Promise<Ok<{ offset: number; total: number; status: string }> | Fail> {
  const s = await prisma.materialUpload.findUnique({
    where: { id: uploadId },
    select: { receivedSize: true, totalSize: true, status: true },
  })
  if (!s) return fail(404, "Sesión de subida no encontrada")
  return {
    ok: true,
    offset: Number(s.receivedSize),
    total: Number(s.totalSize),
    status: s.status,
  }
}

// -----------------------------------------------------------------------------
//  appendChunk
// -----------------------------------------------------------------------------

export async function appendChunk(
  uploadId: string,
  expectedOffset: number,
  stream: Readable | ReadableStream<Uint8Array>,
): Promise<Ok<{ offset: number }> | Fail> {
  const s = await prisma.materialUpload.findUnique({
    where: { id: uploadId },
    select: { tempKey: true, receivedSize: true, totalSize: true, status: true },
  })
  if (!s) return fail(404, "Sesión de subida no encontrada")
  if (s.status !== "PENDING") return fail(409, "La subida ya fue finalizada")

  const received = Number(s.receivedSize)
  // Desincronización: el cliente debe reanudar desde el offset real.
  if (expectedOffset !== received) {
    return fail(409, "Offset desincronizado", received)
  }

  // Descarta cualquier byte parcial que haya quedado de un intento cortado a la
  // mitad (el pipeline pudo escribir a disco sin que persistiéramos el offset).
  await storage().truncateTo(s.tempKey, received)

  const { size } = await storage().appendChunk(s.tempKey, stream)

  if (BigInt(size) > s.totalSize) {
    return fail(400, "El chunk excede el tamaño declarado del archivo")
  }

  await prisma.materialUpload.update({
    where: { id: uploadId },
    data: { receivedSize: BigInt(size) },
  })

  return { ok: true, offset: size }
}

// -----------------------------------------------------------------------------
//  completeSession — promueve el temporal y crea el MaterialFile
// -----------------------------------------------------------------------------

export async function completeSession(
  uploadId: string,
  userId: string,
): Promise<
  | Ok<{ file: { id: string; name: string; size: string; mimeType: string; uploadedAt: Date } }>
  | Fail
> {
  const s = await prisma.materialUpload.findUnique({
    where: { id: uploadId },
    select: {
      id: true,
      folderId: true,
      name: true,
      mimeType: true,
      tempKey: true,
      totalSize: true,
      receivedSize: true,
      status: true,
    },
  })
  if (!s) return fail(404, "Sesión de subida no encontrada")
  if (s.status !== "PENDING") return fail(409, "La subida ya fue finalizada")
  if (s.receivedSize !== s.totalSize) {
    return fail(400, "La subida está incompleta")
  }

  // Otro archivo con el mismo nombre pudo crearse mientras subíamos.
  const conflict = await findFileByNameInFolder(s.folderId, s.name)
  if (conflict) return fail(409, "Ya existe un archivo con ese nombre")

  const finalKey = finalStorageKey(s.folderId, s.name)
  const { size } = await storage().promote(s.tempKey, finalKey)

  try {
    const file = await prisma.$transaction(async (tx) => {
      const created = await tx.materialFile.create({
        data: {
          folderId: s.folderId,
          name: s.name,
          storageKey: finalKey,
          size: BigInt(size),
          mimeType: s.mimeType,
          uploadedById: userId,
        },
        select: { id: true, name: true, size: true, mimeType: true, uploadedAt: true },
      })
      await tx.materialUpload.delete({ where: { id: s.id } })
      return created
    })

    return {
      ok: true,
      file: {
        id: file.id,
        name: file.name,
        size: file.size.toString(),
        mimeType: file.mimeType,
        uploadedAt: file.uploadedAt,
      },
    }
  } catch (err) {
    // La tx falló tras promover el blob: limpiamos el huérfano para no dejar
    // basura en disco sin registro en BD.
    await storage()
      .delete(finalKey)
      .catch(() => {})
    throw err
  }
}

// -----------------------------------------------------------------------------
//  abortSession — cancela y limpia
// -----------------------------------------------------------------------------

export async function abortSession(uploadId: string): Promise<Ok<object> | Fail> {
  const s = await prisma.materialUpload.findUnique({
    where: { id: uploadId },
    select: { id: true, tempKey: true },
  })
  if (!s) return fail(404, "Sesión de subida no encontrada")

  await storage()
    .delete(s.tempKey)
    .catch(() => {})
  await prisma.materialUpload.delete({ where: { id: s.id } })
  return { ok: true }
}
