import "server-only"
import { prisma } from "@/lib/prisma"

/**
 * Lecturas server-only para la edición de consignas de redacción del
 * placement test. La consigna se edita dentro de la página de cada nivel
 * del banco de evaluación (`/admin/preguntas/[levelCode]`), no en una
 * pantalla aparte — todo lo de un nivel vive junto.
 */

export type WritingSection = {
  templateId: string
  sectionId: string
  writingPrompt: string | null
  passingPercent: number
}

/**
 * Devuelve la sección de writing del placement test activo para un idioma y
 * nivel CEFR dados. `null` si no hay plantilla de ubicación para el idioma o
 * la plantilla no tiene una sección para ese nivel.
 */
export async function getWritingSectionForLevel(
  languageId: string,
  cefrLevelId: string,
): Promise<WritingSection | null> {
  const template = await prisma.testTemplate.findFirst({
    where: { languageId, purpose: "PLACEMENT", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  if (!template) return null

  const section = await prisma.testTemplateSection.findUnique({
    where: { templateId_levelId: { templateId: template.id, levelId: cefrLevelId } },
    select: { id: true, writingPrompt: true, passingPercent: true },
  })
  if (!section) return null

  return {
    templateId: template.id,
    sectionId: section.id,
    writingPrompt: section.writingPrompt,
    passingPercent: section.passingPercent,
  }
}
