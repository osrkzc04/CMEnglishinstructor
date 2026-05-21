import "server-only"

import { prisma } from "@/lib/prisma"

/**
 * Lecturas para la administración del placement test.
 *
 * Stubs de Fase 1 — se implementan en Fase 2 (listado/alta) y Fase 4 (revisión).
 */

export async function listPlacementTemplates() {
  return prisma.testTemplate.findMany({
    where: { purpose: "PLACEMENT", isActive: true },
    include: {
      sections: {
        include: { level: true },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getPlacementTemplate(templateId: string) {
  return prisma.testTemplate.findFirst({
    where: { id: templateId, purpose: "PLACEMENT" },
    include: {
      sections: {
        include: { level: true },
        orderBy: { order: "asc" },
      },
    },
  })
}

// La directora va a ver primero un listado de SESSIONS recientes (no de templates),
// porque las plantillas son pocas y los exámenes son lo que se gestiona día a día.
// Esta query la implementa Fase 4 — devuelve sesiones con estado derivado, candidato,
// nivel propuesto si ya hay PlacementSkillEvaluation, fecha, etc.
export async function listRecentPlacementSessions() {
  // TODO Fase 4
  return [] as never[]
}
