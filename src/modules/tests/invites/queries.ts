import "server-only"

import { Prisma, type TestSessionStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { TestInviteListFiltersSchema, type TestInviteListFilters } from "./schemas"

/**
 * Lecturas server-only para el listado admin de invitaciones a placement test.
 *
 * Estado derivado por candidato:
 *   - REVIEWED       → la sesión ya pasó por revisión humana
 *   - SUBMITTED      → enviada pero no revisada
 *   - TIMED_OUT      → vencida durante el intento
 *   - IN_PROGRESS    → intento abierto
 *   - PENDING        → token vigente, todavía no usado
 *   - EXPIRED        → token vencido sin haberse iniciado
 *
 * Cada `InviteToken` tiene 0 o 1 `TestSession`. Si está usado (`usedAt` no
 * null), normalmente hay sesión; pero hay una ventana donde podría no
 * existir todavía si el caller falló entre marcar usado y crear sesión —
 * por eso el mapping protege ambos casos.
 */

export type InviteState =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "TIMED_OUT"
  | "REVIEWED"
  | "EXPIRED"

export type InviteListItem = {
  id: string
  token: string
  candidateName: string
  candidateEmail: string
  candidatePhone: string | null
  candidateDocument: string | null
  notes: string | null
  templateId: string
  templateName: string
  createdAt: Date
  expiresAt: Date
  usedAt: Date | null
  state: InviteState
  sessionId: string | null
  sessionStatus: TestSessionStatus | null
  submittedAt: Date | null
  reviewedAt: Date | null
  autoScore: number | null
  maxAutoScore: number | null
}

export type InviteListResult = {
  items: InviteListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function listTestInvites(
  raw: Partial<TestInviteListFilters>,
): Promise<InviteListResult> {
  const filters = TestInviteListFiltersSchema.parse(raw)
  const where = buildWhere(filters)

  const [rows, total] = await prisma.$transaction([
    prisma.inviteToken.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      select: {
        id: true,
        token: true,
        candidateName: true,
        candidateEmail: true,
        candidatePhone: true,
        candidateDocument: true,
        notes: true,
        createdAt: true,
        expiresAt: true,
        usedAt: true,
        template: { select: { id: true, name: true } },
        session: {
          select: {
            id: true,
            status: true,
            submittedAt: true,
            reviewedAt: true,
            autoScore: true,
            maxAutoScore: true,
          },
        },
      },
    }),
    prisma.inviteToken.count({ where }),
  ])

  const items: InviteListItem[] = rows.map((row) => {
    const session = row.session
    const state = deriveState({
      now: new Date(),
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
      session,
    })
    return {
      id: row.id,
      token: row.token,
      candidateName: row.candidateName,
      candidateEmail: row.candidateEmail,
      candidatePhone: row.candidatePhone,
      candidateDocument: row.candidateDocument,
      notes: row.notes,
      templateId: row.template.id,
      templateName: row.template.name,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
      state,
      sessionId: session?.id ?? null,
      sessionStatus: session?.status ?? null,
      submittedAt: session?.submittedAt ?? null,
      reviewedAt: session?.reviewedAt ?? null,
      autoScore: session?.autoScore ?? null,
      maxAutoScore: session?.maxAutoScore ?? null,
    }
  })

  // Filtrado por estado se hace en memoria porque depende de fields derivados
  // de la sesión + comparación contra now() — un WHERE Prisma no expresa el
  // estado "EXPIRED" sin un raw query. Para volúmenes esperados (cientos por
  // mes) es aceptable; si escala mucho, mover a una vista materializada.
  const filtered = filters.state ? items.filter((i) => i.state === filters.state) : items

  return {
    items: filtered,
    total: filters.state ? filtered.length : total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(
      1,
      Math.ceil((filters.state ? filtered.length : total) / filters.pageSize),
    ),
  }
}

function buildWhere(filters: TestInviteListFilters): Prisma.InviteTokenWhereInput {
  const where: Prisma.InviteTokenWhereInput = {}
  if (filters.q) {
    where.OR = [
      { candidateName: { contains: filters.q, mode: "insensitive" } },
      { candidateEmail: { contains: filters.q, mode: "insensitive" } },
      { candidateDocument: { contains: filters.q, mode: "insensitive" } },
    ]
  }
  return where
}

function deriveState(args: {
  now: Date
  expiresAt: Date
  usedAt: Date | null
  session: { status: TestSessionStatus } | null
}): InviteState {
  if (args.session) {
    switch (args.session.status) {
      case "REVIEWED":
        return "REVIEWED"
      case "SUBMITTED":
        return "SUBMITTED"
      case "TIMED_OUT":
        return "TIMED_OUT"
      case "IN_PROGRESS":
        return "IN_PROGRESS"
      case "ABANDONED":
        return "TIMED_OUT"
    }
  }
  if (args.expiresAt < args.now) return "EXPIRED"
  return "PENDING"
}

// -----------------------------------------------------------------------------
//  Detalle por id — usado por la action de reenvío y eventualmente por
//  /admin/pruebas/[id]
// -----------------------------------------------------------------------------

export async function getInviteForResend(inviteId: string) {
  return prisma.inviteToken.findFirst({
    where: { id: inviteId },
    select: {
      id: true,
      token: true,
      candidateName: true,
      candidateEmail: true,
      expiresAt: true,
      usedAt: true,
      template: { select: { id: true, timeLimitMinutes: true } },
      session: { select: { id: true, status: true } },
    },
  })
}

// -----------------------------------------------------------------------------
//  KPIs del strip — total / pendientes / en progreso / por revisar / completas
// -----------------------------------------------------------------------------

export type InviteStats = {
  total: number
  pending: number
  inProgress: number
  awaitingReview: number
  reviewed: number
  expired: number
}

export async function getInviteStats(): Promise<InviteStats> {
  const now = new Date()
  const [total, inProgress, submitted, timedOut, reviewed, pendingActive, pendingExpired] =
    await prisma.$transaction([
      prisma.inviteToken.count(),
      prisma.testSession.count({ where: { status: "IN_PROGRESS" } }),
      prisma.testSession.count({ where: { status: "SUBMITTED" } }),
      prisma.testSession.count({ where: { status: "TIMED_OUT" } }),
      prisma.testSession.count({ where: { status: "REVIEWED" } }),
      prisma.inviteToken.count({
        where: { usedAt: null, expiresAt: { gte: now } },
      }),
      prisma.inviteToken.count({
        where: { usedAt: null, expiresAt: { lt: now } },
      }),
    ])

  return {
    total,
    pending: pendingActive,
    inProgress,
    awaitingReview: submitted + timedOut,
    reviewed,
    expired: pendingExpired,
  }
}
