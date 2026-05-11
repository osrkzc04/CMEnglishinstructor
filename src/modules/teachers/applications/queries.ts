import "server-only"
import { cache } from "react"
import { Prisma, ApplicationStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ApplicationListFiltersSchema, type ApplicationListFilters } from "./schemas"

/**
 * Lectura de TeacherApplication para el panel admin. Centraliza la query del
 * listado paginado + búsqueda + filtros y el detalle por id usado al editar.
 */

export type ApplicationListItem = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  document: string
  status: ApplicationStatus
  createdAt: Date
  reviewedAt: Date | null
  levels: { id: string; code: string; name: string }[]
}

export type ApplicationListResult = {
  items: ApplicationListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Lista postulaciones con búsqueda case-insensitive sobre nombre/correo/doc,
 * filtro de estado y paginación por offset. El total se calcula con la misma
 * cláusula `where` para que la pager refleje el resultado filtrado.
 */
export async function listApplications(
  raw: Partial<ApplicationListFilters>,
): Promise<ApplicationListResult> {
  const filters = ApplicationListFiltersSchema.parse(raw)
  const where = buildWhere(filters)

  const [items, total] = await prisma.$transaction([
    prisma.teacherApplication.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: {
        appliedLevels: { include: { level: true } },
      },
    }),
    prisma.teacherApplication.count({ where }),
  ])

  return {
    items: items.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      document: row.document,
      status: row.status,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt,
      levels: row.appliedLevels.map((al) => ({
        id: al.level.id,
        code: al.level.code,
        name: al.level.name,
      })),
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  }
}

function buildWhere(filters: ApplicationListFilters): Prisma.TeacherApplicationWhereInput {
  const where: Prisma.TeacherApplicationWhereInput = {}
  if (filters.status) where.status = filters.status
  if (filters.q) {
    where.OR = [
      { firstName: { contains: filters.q, mode: "insensitive" } },
      { lastName: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
      { document: { contains: filters.q, mode: "insensitive" } },
    ]
  }
  return where
}

// -----------------------------------------------------------------------------
//  Detalle por id (para precargar el form en modo edición)
// -----------------------------------------------------------------------------

export type ApplicationDetail = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  document: string
  bio: string | null
  status: ApplicationStatus
  cvStorageKey: string | null
  levelIds: string[]
  availability: { dayOfWeek: number; startTime: string; endTime: string }[]
}

export const getApplicationById = cache(async (id: string): Promise<ApplicationDetail | null> => {
  const row = await prisma.teacherApplication.findUnique({
    where: { id },
    include: {
      appliedLevels: true,
      proposedAvailability: {
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
    },
  })
  if (!row) return null
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    document: row.document,
    bio: row.bio,
    status: row.status,
    cvStorageKey: row.cvStorageKey,
    levelIds: row.appliedLevels.map((l) => l.levelId),
    availability: row.proposedAvailability.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
    })),
  }
})

// -----------------------------------------------------------------------------
//  Detalle completo (página /admin/postulaciones/[id])
// -----------------------------------------------------------------------------

export type ApplicationFullDetail = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  document: string
  bio: string | null
  status: ApplicationStatus
  cvStorageKey: string | null
  createdAt: Date
  consentAcceptedAt: Date | null
  reviewedAt: Date | null
  rejectionReason: string | null
  reviewer: { name: string } | null
  /** Si APPROVED, apunta al User creado para enlazar al detalle del docente. */
  userId: string | null
  levels: {
    id: string
    code: string
    name: string
    languageName: string
  }[]
  availability: { dayOfWeek: number; startTime: string; endTime: string }[]
}

export const getApplicationFullDetail = cache(
  async (id: string): Promise<ApplicationFullDetail | null> => {
    const row = await prisma.teacherApplication.findUnique({
      where: { id },
      include: {
        appliedLevels: { include: { level: { include: { language: true } } } },
        proposedAvailability: {
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        },
      },
    })
    if (!row) return null

    const reviewer = row.reviewedBy
      ? await prisma.user.findUnique({
          where: { id: row.reviewedBy },
          select: { firstName: true, lastName: true },
        })
      : null

    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      document: row.document,
      bio: row.bio,
      status: row.status,
      cvStorageKey: row.cvStorageKey,
      createdAt: row.createdAt,
      consentAcceptedAt: row.consentAcceptedAt,
      reviewedAt: row.reviewedAt,
      rejectionReason: row.rejectionReason,
      reviewer: reviewer ? { name: `${reviewer.firstName} ${reviewer.lastName}` } : null,
      userId: row.userId,
      levels: row.appliedLevels
        .map((al) => ({
          id: al.level.id,
          code: al.level.code,
          name: al.level.name,
          languageName: al.level.language.name,
        }))
        .sort((a, b) =>
          a.languageName === b.languageName
            ? a.code.localeCompare(b.code)
            : a.languageName.localeCompare(b.languageName),
        ),
      availability: row.proposedAvailability.map((a) => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
    }
  },
)

// -----------------------------------------------------------------------------
//  CEFR levels (English) — opciones del multiselect del form
// -----------------------------------------------------------------------------

export type CefrOption = { id: string; code: string; name: string; order: number }

export const listEnglishCefrLevels = cache(async (): Promise<CefrOption[]> => {
  const rows = await prisma.cefrLevel.findMany({
    where: { language: { code: "en" } },
    orderBy: { order: "asc" },
  })
  return rows.map((r) => ({ id: r.id, code: r.code, name: r.name, order: r.order }))
})
