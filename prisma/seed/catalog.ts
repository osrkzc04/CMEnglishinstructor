import { PrismaClient, ProgramStructure } from "@prisma/client"

/**
 * Siembra el catálogo académico: idiomas, niveles CEFR y la jerarquía
 * Course → Program → ProgramLevel derivada del Excel de la directora.
 *
 * Idempotencia: usa `upsert` para Language y CefrLevel. Para Course/Program/
 * ProgramLevel verifica con `count()` y saltea si ya hay datos — el catálogo
 * se modifica vía UI después del primer arranque.
 */
export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  // -------------------------------------------------------------------------
  // Idiomas
  // -------------------------------------------------------------------------
  const english = await prisma.language.upsert({
    where: { code: "en" },
    update: {},
    create: { code: "en", name: "English" },
  })
  const spanish = await prisma.language.upsert({
    where: { code: "es" },
    update: {},
    create: { code: "es", name: "Español" },
  })

  // -------------------------------------------------------------------------
  // Niveles CEFR (A1–C2) por idioma
  // -------------------------------------------------------------------------
  const cefrCodes = ["A1", "A2", "B1", "B2", "C1", "C2"]
  const cefrNames = [
    "Beginner",
    "Elementary",
    "Intermediate",
    "Upper-Intermediate",
    "Advanced",
    "Proficient",
  ]
  for (const lang of [english, spanish]) {
    for (let i = 0; i < cefrCodes.length; i++) {
      await prisma.cefrLevel.upsert({
        where: { languageId_code: { languageId: lang.id, code: cefrCodes[i]! } },
        update: {},
        create: {
          languageId: lang.id,
          code: cefrCodes[i]!,
          name: cefrNames[i]!,
          order: i + 1,
        },
      })
    }
  }

  // -------------------------------------------------------------------------
  // Catálogo académico (idempotente por count)
  // -------------------------------------------------------------------------
  if ((await prisma.course.count()) > 0) {
    return
  }

  // --- General English ---
  const generalEnglish = await prisma.course.create({
    data: {
      languageId: english.id,
      name: "General English",
      description:
        "Inglés general para adultos, enfocado en comunicación cotidiana y profesional.",
      baseHours: 48,
      classDuration: 60,
      pricePerHour: 25.0,
    },
  })

  // Time Zones (NG Learning) — niveles 1-4
  const timeZones = await prisma.program.create({
    data: {
      courseId: generalEnglish.id,
      name: "Time Zones",
      publisher: "National Geographic Learning",
      platformName: "National Geographic Learning",
      platformUrl: "https://learning.eltngl.com",
      structureType: ProgramStructure.SEQUENTIAL,
    },
  })
  for (let i = 1; i <= 4; i++) {
    await prisma.programLevel.create({
      data: {
        programId: timeZones.id,
        code: String(i),
        name: `Time Zones ${i}`,
        order: i,
        cefrLevelCode: ["A1", "A2", "A2", "B1"][i - 1]!,
      },
    })
  }

  // Life (NG Learning) — niveles 1-6 plataforma, 1-5 PDF
  const life = await prisma.program.create({
    data: {
      courseId: generalEnglish.id,
      name: "Life",
      publisher: "National Geographic Learning",
      platformName: "National Geographic Learning",
      platformUrl: "https://learning.eltngl.com",
      structureType: ProgramStructure.SEQUENTIAL,
    },
  })
  for (let i = 1; i <= 6; i++) {
    await prisma.programLevel.create({
      data: {
        programId: life.id,
        code: String(i),
        name: `Life ${i}`,
        order: i,
        cefrLevelCode: ["A1", "A2", "B1", "B1", "B2", "C1"][i - 1]!,
        hasPdfMaterial: i <= 5,
      },
    })
  }

  // Perspectives (NG Learning) — niveles 1-4, sin PDF según el Excel
  const perspectives = await prisma.program.create({
    data: {
      courseId: generalEnglish.id,
      name: "Perspectives",
      publisher: "National Geographic Learning",
      platformName: "National Geographic Learning",
      platformUrl: "https://learning.eltngl.com",
      structureType: ProgramStructure.SEQUENTIAL,
    },
  })
  for (let i = 1; i <= 4; i++) {
    await prisma.programLevel.create({
      data: {
        programId: perspectives.id,
        code: String(i),
        name: `Perspectives ${i}`,
        order: i,
        cefrLevelCode: ["A1", "A2", "B1", "B2"][i - 1]!,
        hasPdfMaterial: false,
      },
    })
  }

  // --- Business English ---
  const businessEnglish = await prisma.course.create({
    data: {
      languageId: english.id,
      name: "Business English",
      description:
        "Inglés empresarial para ejecutivos y profesionales corporativos.",
      baseHours: 72,
      classDuration: 60,
      pricePerHour: 35.0,
    },
  })

  const marketLeader = await prisma.program.create({
    data: {
      courseId: businessEnglish.id,
      name: "Market Leader",
      publisher: "Pearson Education",
      platformName: "Pearson English Portal",
      platformUrl: "https://english.com",
      structureType: ProgramStructure.SEQUENTIAL,
    },
  })
  const mlLevels = [
    { code: "Elementary", cefr: "A2" },
    { code: "Pre-Intermediate", cefr: "A2" },
    { code: "Intermediate", cefr: "B1" },
    { code: "Upper-Intermediate", cefr: "B2" },
    { code: "Advanced", cefr: "C1" },
  ]
  for (let i = 0; i < mlLevels.length; i++) {
    await prisma.programLevel.create({
      data: {
        programId: marketLeader.id,
        code: mlLevels[i]!.code,
        name: `Market Leader ${mlLevels[i]!.code}`,
        order: i + 1,
        cefrLevelCode: mlLevels[i]!.cefr,
      },
    })
  }

  const specialization = await prisma.program.create({
    data: {
      courseId: businessEnglish.id,
      name: "Specialization",
      publisher: "Pearson Education",
      platformName: null,
      platformUrl: null,
      structureType: ProgramStructure.MODULAR,
    },
  })
  const specModules = [
    "Presenting",
    "Meetings",
    "Socialising",
    "Negotiating",
    "Using Social Media",
    "Emailing",
    "Telephoning",
    "Business Grammar and Vocabulary",
    "Business Grammar and Usage",
  ]
  for (let i = 0; i < specModules.length; i++) {
    await prisma.programLevel.create({
      data: {
        programId: specialization.id,
        code: specModules[i]!,
        name: specModules[i]!,
        order: i + 1,
        hasPlatformAccess: false,
      },
    })
  }

  // --- Kids Learning (integral, SINGLE) ---
  const kidsLearning = await prisma.course.create({
    data: {
      languageId: english.id,
      name: "Kids Learning",
      description:
        "Programa integral de inglés para niños, combinando lectura y escritura.",
      baseHours: 40,
      classDuration: 60,
      pricePerHour: 20.0,
    },
  })
  const kidsProgram = await prisma.program.create({
    data: {
      courseId: kidsLearning.id,
      name: "Kids English",
      publisher: null,
      structureType: ProgramStructure.SINGLE,
    },
  })
  await prisma.programLevel.create({
    data: {
      programId: kidsProgram.id,
      code: "Integral",
      name: "Kids English Integral",
      order: 1,
      hasPlatformAccess: false,
    },
  })

  // --- Spanish ---
  const spanishCourse = await prisma.course.create({
    data: {
      languageId: spanish.id,
      name: "Español",
      description: "Curso de español como lengua extranjera.",
      baseHours: 48,
      classDuration: 60,
      pricePerHour: 25.0,
    },
  })
  const vistas = await prisma.program.create({
    data: {
      courseId: spanishCourse.id,
      name: "Vistas",
      publisher: "Vistas",
      platformName: null,
      structureType: ProgramStructure.SEQUENTIAL,
    },
  })
  for (let i = 1; i <= 6; i++) {
    await prisma.programLevel.create({
      data: {
        programId: vistas.id,
        code: String(i),
        name: `Vistas ${i}`,
        order: i,
        cefrLevelCode: ["A1", "A2", "B1", "B2", "C1", "C2"][i - 1]!,
        hasPlatformAccess: false,
      },
    })
  }
}
