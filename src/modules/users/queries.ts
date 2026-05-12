import "server-only"
import { cache } from "react"
import { Prisma, type Role, UserStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { StaffListFiltersSchema, type StaffListFilters } from "./schemas"

/**
 * Lectura del módulo de usuarios staff (DIRECTOR / COORDINATOR) para el
 * panel admin. Distinto del módulo de estudiantes / docentes porque acá no
 * hay perfil asociado — solo el `User`.
 */

const STAFF_ROLES: Role[] = ["DIRECTOR", "COORDINATOR"]

// -----------------------------------------------------------------------------
//  Listado paginado
// -----------------------------------------------------------------------------

export type StaffListItem = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  document: string | null
  role: Role
  status: UserStatus
  createdAt: Date
  hasPassword: boolean
}

export type StaffListResult = {
  items: StaffListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function listStaff(raw: Partial<StaffListFilters>): Promise<StaffListResult> {
  const filters = StaffListFiltersSchema.parse(raw)
  const where = buildWhere(filters)

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: [{ status: "asc" }, { role: "asc" }, { createdAt: "desc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        document: true,
        role: true,
        status: true,
        createdAt: true,
        passwordHash: true,
      },
    }),
    prisma.user.count({ where }),
  ])

  return {
    items: users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      document: u.document,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      hasPassword: u.passwordHash !== null,
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  }
}

function buildWhere(filters: StaffListFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { role: { in: STAFF_ROLES } }
  if (filters.status) where.status = filters.status
  if (filters.role) where.role = filters.role
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
//  Detalle (para forms de edición)
// -----------------------------------------------------------------------------

export type StaffDetail = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  document: string | null
  role: Role
  status: UserStatus
  createdAt: Date
  hasPassword: boolean
}

export const getStaffDetail = cache(async (id: string): Promise<StaffDetail | null> => {
  const user = await prisma.user.findFirst({
    where: { id, role: { in: STAFF_ROLES } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      document: true,
      role: true,
      status: true,
      createdAt: true,
      passwordHash: true,
    },
  })
  if (!user) return null
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    document: user.document,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    hasPassword: user.passwordHash !== null,
  }
})

// -----------------------------------------------------------------------------
//  KPIs del strip
// -----------------------------------------------------------------------------

export type StaffStats = {
  total: number
  active: number
  inactive: number
  pending: number
  directors: number
  coordinators: number
}

export const getStaffStats = cache(async (): Promise<StaffStats> => {
  const [total, active, inactive, pending, directors, coordinators] = await prisma.$transaction([
    prisma.user.count({ where: { role: { in: STAFF_ROLES } } }),
    prisma.user.count({ where: { role: { in: STAFF_ROLES }, status: UserStatus.ACTIVE } }),
    prisma.user.count({ where: { role: { in: STAFF_ROLES }, status: UserStatus.INACTIVE } }),
    prisma.user.count({
      where: { role: { in: STAFF_ROLES }, status: UserStatus.PENDING_APPROVAL },
    }),
    prisma.user.count({ where: { role: "DIRECTOR" } }),
    prisma.user.count({ where: { role: "COORDINATOR" } }),
  ])
  return { total, active, inactive, pending, directors, coordinators }
})

// -----------------------------------------------------------------------------
//  Cuenta de directores activos — usado por guards para evitar quedarse sin
//  director (deshabilitar o cambiar el rol del último DIRECTOR ACTIVE).
// -----------------------------------------------------------------------------

export async function countActiveDirectors(excludeId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      role: "DIRECTOR",
      status: UserStatus.ACTIVE,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  })
}
