import "server-only"
import { prisma } from "@/lib/prisma"

/**
 * Lecturas del repositorio de materiales.
 *
 * El árbol vive en la DB; el storage solo guarda los blobs. Las queries de
 * navegación filtran soft-deleted (`deletedAt = null`) — el cleanup real
 * del disco corre en un job aparte.
 */

export type ProgramLevelRoot = {
  programLevelId: string
  programName: string
  levelCode: string
  levelName: string
  rootFolderId: string
  folderCount: number
  fileCount: number
}

/**
 * Lista las raíces de cada `ProgramLevel`, creando la carpeta raíz on-demand
 * si todavía no existe. Pensada para la página de admin que muestra "todos
 * los niveles" con sus contadores.
 */
export async function listProgramLevelRoots(opts?: {
  programLevelIds?: string[]
}): Promise<ProgramLevelRoot[]> {
  const levels = await prisma.programLevel.findMany({
    where: opts?.programLevelIds ? { id: { in: opts.programLevelIds } } : undefined,
    orderBy: [{ program: { name: "asc" } }, { order: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      program: { select: { name: true } },
      materialFolders: {
        where: { parentId: null, deletedAt: null },
        select: {
          id: true,
          _count: { select: { children: { where: { deletedAt: null } }, files: { where: { deletedAt: null } } } },
        },
        take: 1,
      },
    },
  })

  // Crear roots faltantes (en una sola pasada serial — el caso normal es 0-1).
  const result: ProgramLevelRoot[] = []
  for (const lvl of levels) {
    let root = lvl.materialFolders[0]
    if (!root) {
      const created = await ensureLevelRoot(lvl.id, lvl.name)
      root = {
        id: created.id,
        _count: { children: 0, files: 0 },
      }
    }
    result.push({
      programLevelId: lvl.id,
      programName: lvl.program.name,
      levelCode: lvl.code,
      levelName: lvl.name,
      rootFolderId: root.id,
      folderCount: root._count.children,
      fileCount: root._count.files,
    })
  }
  return result
}

/**
 * Crea (idempotente) la carpeta raíz de un `ProgramLevel`. Necesita un
 * usuario con rol admin como creador — se resuelve desde la sesión cuando
 * la llama una page; en background jobs se pasa explícito.
 *
 * Devuelve `{ id }` minimalista para encadenar.
 */
export async function ensureLevelRoot(
  programLevelId: string,
  fallbackName: string,
  createdById?: string,
): Promise<{ id: string }> {
  const existing = await prisma.materialFolder.findFirst({
    where: { programLevelId, parentId: null, deletedAt: null },
    select: { id: true },
  })
  if (existing) return existing

  // Si nadie pasó creador, pegamos al primer DIRECTOR activo. Caso borde:
  // puede no haber ninguno todavía, pero el flujo normal de admin pasa
  // por una sesión válida.
  let userId = createdById
  if (!userId) {
    const owner = await prisma.user.findFirst({
      where: { role: "DIRECTOR", status: "ACTIVE" },
      select: { id: true },
    })
    if (!owner) throw new Error("No hay director activo para crear el repositorio")
    userId = owner.id
  }

  return prisma.materialFolder.create({
    data: {
      programLevelId,
      parentId: null,
      name: fallbackName,
      createdById: userId,
    },
    select: { id: true },
  })
}

// -----------------------------------------------------------------------------
//  Detalle de carpeta
// -----------------------------------------------------------------------------

export type FolderItem =
  | {
      kind: "folder"
      id: string
      name: string
      childFolderCount: number
      fileCount: number
      updatedAt: Date
    }
  | {
      kind: "file"
      id: string
      name: string
      size: bigint
      mimeType: string
      uploadedAt: Date
    }

export type FolderDetail = {
  id: string
  name: string
  parentId: string | null
  programLevelId: string
  programName: string
  levelName: string
  isRoot: boolean
  breadcrumb: { id: string; name: string }[]
  items: FolderItem[]
}

export async function getFolderDetail(folderId: string): Promise<FolderDetail | null> {
  const folder = await prisma.materialFolder.findUnique({
    where: { id: folderId },
    select: {
      id: true,
      name: true,
      parentId: true,
      programLevelId: true,
      deletedAt: true,
      programLevel: {
        select: { name: true, program: { select: { name: true } } },
      },
      children: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          updatedAt: true,
          _count: {
            select: {
              children: { where: { deletedAt: null } },
              files: { where: { deletedAt: null } },
            },
          },
        },
      },
      files: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          size: true,
          mimeType: true,
          uploadedAt: true,
        },
      },
    },
  })
  if (!folder || folder.deletedAt) return null

  const breadcrumb = await getBreadcrumb(folderId)

  const items: FolderItem[] = [
    ...folder.children.map((c) => ({
      kind: "folder" as const,
      id: c.id,
      name: c.name,
      childFolderCount: c._count.children,
      fileCount: c._count.files,
      updatedAt: c.updatedAt,
    })),
    ...folder.files.map((f) => ({
      kind: "file" as const,
      id: f.id,
      name: f.name,
      size: f.size,
      mimeType: f.mimeType,
      uploadedAt: f.uploadedAt,
    })),
  ]

  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    programLevelId: folder.programLevelId,
    programName: folder.programLevel.program.name,
    levelName: folder.programLevel.name,
    isRoot: folder.parentId === null,
    breadcrumb,
    items,
  }
}

async function getBreadcrumb(folderId: string): Promise<{ id: string; name: string }[]> {
  // Subimos la cadena con queries simples — los árboles son chicos (< 10
  // niveles en la práctica) y evitamos el WITH RECURSIVE.
  const trail: { id: string; name: string }[] = []
  let currentId: string | null = folderId
  while (currentId) {
    const node: { id: string; name: string; parentId: string | null } | null =
      await prisma.materialFolder.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, parentId: true },
      })
    if (!node) break
    trail.unshift({ id: node.id, name: node.name })
    currentId = node.parentId
  }
  return trail
}

// -----------------------------------------------------------------------------
//  Helpers para uniqueness / lookups puntuales
// -----------------------------------------------------------------------------

export async function findFolderByNameInParent(
  parentId: string,
  name: string,
  excludeFolderId?: string,
): Promise<{ id: string } | null> {
  return prisma.materialFolder.findFirst({
    where: {
      parentId,
      name,
      deletedAt: null,
      ...(excludeFolderId ? { id: { not: excludeFolderId } } : {}),
    },
    select: { id: true },
  })
}

export async function findFileByNameInFolder(
  folderId: string,
  name: string,
  excludeFileId?: string,
): Promise<{ id: string } | null> {
  return prisma.materialFile.findFirst({
    where: {
      folderId,
      name,
      deletedAt: null,
      ...(excludeFileId ? { id: { not: excludeFileId } } : {}),
    },
    select: { id: true },
  })
}
