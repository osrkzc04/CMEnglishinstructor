import { PrismaClient, TestPurpose } from "@prisma/client"

/**
 * Siembra la plantilla de placement test adaptativa (6 secciones A1→C2) en
 * inglés. Idempotente: si ya existe cualquier `TestTemplate` con
 * `purpose = PLACEMENT`, no hace nada.
 *
 * No es data demo — sin esta plantilla la página de `/admin/pruebas` no
 * puede emitir invitaciones. Por eso vive aquí y la invocan tanto el seed
 * de dev como el de producción.
 *
 * Cuando el banco real esté cargado, coordinación puede ajustar
 * `samplePoolSize` / `questionCount` / `passingPercent` desde la UI sin
 * que este seed los pise.
 */
export async function seedPlacementTemplate(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.testTemplate.count({
    where: { purpose: TestPurpose.PLACEMENT },
  })
  if (existing > 0) return

  const english = await prisma.language.findUnique({ where: { code: "en" } })
  if (!english) {
    throw new Error("Idioma 'en' no encontrado. Corre seedCatalog antes de seedPlacementTemplate.")
  }

  const enLevels = await prisma.cefrLevel.findMany({
    where: { languageId: english.id },
  })
  const enLevelByCode = new Map(enLevels.map((l) => [l.code, l]))

  const placementSectionLevels: { code: string; order: number }[] = [
    { code: "A1", order: 1 },
    { code: "A2", order: 2 },
    { code: "B1", order: 3 },
    { code: "B2", order: 4 },
    { code: "C1", order: 5 },
    { code: "C2", order: 6 },
  ]

  const sectionsCreate = placementSectionLevels.map(({ code, order }) => {
    const level = enLevelByCode.get(code)
    if (!level) throw new Error(`CEFR level ${code} no encontrado para placement seed`)
    return {
      levelId: level.id,
      order,
      samplePoolSize: 50,
      questionCount: 20,
      passingPercent: 90,
    }
  })

  await prisma.testTemplate.create({
    data: {
      name: "Placement test general — Inglés",
      purpose: TestPurpose.PLACEMENT,
      languageId: english.id,
      // `questionCount` aquí es la suma de las 6 secciones — denormalizado
      // informativo. El motor adaptativo lee desde `sections`.
      questionCount: 120,
      timeLimitMinutes: 60,
      instructions:
        "Responde todas las preguntas de cada bloque. El examen avanza automáticamente cuando completas un bloque. No se puede volver atrás a bloques anteriores.",
      sections: { create: sectionsCreate },
    },
  })
}
