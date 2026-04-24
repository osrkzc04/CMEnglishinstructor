/**
 * CM English Instructor — Database seed
 * ----------------------------------------------------------------------------
 * Popula catálogo académico (derivado del Excel provisto por la directora),
 * niveles CEFR, usuarios demo para cada rol, settings de aplicación, feriados
 * de Ecuador, y un banco mínimo de preguntas de ejemplo.
 *
 * Ejecución:  pnpm db:seed
 * Reset:      pnpm db:reset   (tumba, migra y vuelve a sembrar)
 */

import { PrismaClient, Role, ProgramStructure, QuestionType, TestPurpose, SettingType } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

const DEMO_PASSWORD = "Demo2026!"

async function main() {
  console.log("🌱 Iniciando seed...")

  // -------------------------------------------------------------------------
  // 1. Idiomas y niveles CEFR
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

  const cefrCodes = ["A1", "A2", "B1", "B2", "C1", "C2"]
  const cefrNames = ["Beginner", "Elementary", "Intermediate", "Upper-Intermediate", "Advanced", "Proficient"]

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
  console.log("  ✓ Idiomas y niveles CEFR")

  // -------------------------------------------------------------------------
  // 2. Catálogo académico (derivado del Excel de la directora)
  // -------------------------------------------------------------------------

  // --- General English ---
  const generalEnglish = await prisma.course.create({
    data: {
      languageId: english.id,
      name: "General English",
      description: "Inglés general para adultos, enfocado en comunicación cotidiana y profesional.",
      baseHours: 48,
      classDuration: 45,
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
        hasPdfMaterial: i <= 5, // PDF sólo hasta 5 según el Excel
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
      description: "Inglés empresarial para ejecutivos y profesionales corporativos.",
      baseHours: 72,
      classDuration: 45,
      pricePerHour: 35.0,
    },
  })

  // Market Leader (Pearson) — Elementary → Advanced
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

  // Specialization (Pearson) — MODULAR: cada módulo es independiente
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
      description: "Programa integral de inglés para niños, combinando lectura y escritura.",
      baseHours: 40,
      classDuration: 45,
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
      classDuration: 45,
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

  console.log("  ✓ Catálogo académico")

  // -------------------------------------------------------------------------
  // 3. Usuarios demo (uno por rol)
  // -------------------------------------------------------------------------
  const passwordHash = await hash(DEMO_PASSWORD, 10)

  const director = await prisma.user.upsert({
    where: { email: "directora@cmenglish.test" },
    update: {},
    create: {
      email: "directora@cmenglish.test",
      passwordHash,
      firstName: "Carolina",
      lastName: "Monsalve",
      role: Role.DIRECTOR,
      document: "1700000001",
      phone: "+593958747016",
    },
  })

  await prisma.user.upsert({
    where: { email: "coordinacion@cmenglish.test" },
    update: {},
    create: {
      email: "coordinacion@cmenglish.test",
      passwordHash,
      firstName: "Ana",
      lastName: "Coordinadora",
      role: Role.COORDINATOR,
      document: "1700000002",
    },
  })

  const teacher = await prisma.user.upsert({
    where: { email: "docente@cmenglish.test" },
    update: {},
    create: {
      email: "docente@cmenglish.test",
      passwordHash,
      firstName: "María",
      lastName: "Docente",
      role: Role.TEACHER,
      document: "1700000003",
      teacherProfile: {
        create: {
          hireDate: new Date(),
          hourlyRate: 15.0,
          bio: "Docente con certificación TKT y 5 años de experiencia en inglés empresarial.",
          isActive: true,
        },
      },
    },
  })

  // Disponibilidad del docente demo: L-V 19:00-22:00
  for (let day = 1; day <= 5; day++) {
    await prisma.teacherAvailability.create({
      data: {
        teacherId: teacher.id,
        dayOfWeek: day,
        startTime: "19:00",
        endTime: "22:00",
      },
    })
  }

  await prisma.user.upsert({
    where: { email: "estudiante@cmenglish.test" },
    update: {},
    create: {
      email: "estudiante@cmenglish.test",
      passwordHash,
      firstName: "Juan",
      lastName: "Estudiante",
      role: Role.STUDENT,
      document: "1700000004",
      studentProfile: {
        create: {
          company: "Empresa Ejemplo S.A.",
          position: "Gerente de Operaciones",
        },
      },
    },
  })

  console.log("  ✓ Usuarios demo (password: " + DEMO_PASSWORD + ")")

  // -------------------------------------------------------------------------
  // 4. Configuración global (AppSetting)
  // -------------------------------------------------------------------------
  const settings: Array<{ key: string; value: string; type: SettingType; category: string; description: string }> = [
    { key: "default_class_duration_minutes",  value: "45",   type: SettingType.NUMBER,  category: "classes",       description: "Duración por defecto de una clase en minutos." },
    { key: "default_price_per_hour",          value: "25",   type: SettingType.NUMBER,  category: "classes",       description: "Costo por hora por defecto para nuevos cursos." },
    { key: "invite_token_expiration_hours",   value: "24",   type: SettingType.NUMBER,  category: "tests",         description: "Horas de validez del link de invitación a prueba." },
    { key: "candidate_can_view_results",      value: "false", type: SettingType.BOOLEAN, category: "tests",         description: "Si el candidato puede ver su resultado luego de rendir la prueba." },
    { key: "candidate_result_detail_level",   value: "none", type: SettingType.STRING,  category: "tests",         description: "Nivel de detalle visible al candidato: none | score_only | full." },
    { key: "absence_counts_as_consumed",      value: "false", type: SettingType.BOOLEAN, category: "classes",       description: "Si la ausencia del estudiante consume horas contratadas." },
    { key: "notification_weekly_schedule_day",value: "sunday", type: SettingType.STRING, category: "notifications", description: "Día para enviar cronograma semanal." },
    { key: "notification_weekly_schedule_hour",value: "18",  type: SettingType.NUMBER,  category: "notifications", description: "Hora para enviar cronograma semanal (0-23)." },
    { key: "reminder_class_hours_before",     value: "2",    type: SettingType.NUMBER,  category: "notifications", description: "Horas antes de una clase para enviar recordatorio." },
    { key: "log_edit_window_hours",           value: "24",   type: SettingType.NUMBER,  category: "classes",       description: "Ventana en horas para editar bitácora después de cerrar clase." },
  ]

  for (const s of settings) {
    await prisma.appSetting.upsert({
      where: { key: s.key },
      update: {},
      create: { ...s, updatedBy: director.id },
    })
  }
  console.log("  ✓ Configuración global")

  // -------------------------------------------------------------------------
  // 5. Feriados Ecuador 2026 (no exhaustivo, de referencia)
  // -------------------------------------------------------------------------
  const holidays = [
    { date: "2026-01-01", name: "Año Nuevo" },
    { date: "2026-02-16", name: "Carnaval" },
    { date: "2026-02-17", name: "Carnaval" },
    { date: "2026-04-03", name: "Viernes Santo" },
    { date: "2026-05-01", name: "Día del Trabajo" },
    { date: "2026-05-24", name: "Batalla de Pichincha" },
    { date: "2026-08-10", name: "Primer Grito de Independencia" },
    { date: "2026-10-09", name: "Independencia de Guayaquil" },
    { date: "2026-11-02", name: "Día de los Difuntos" },
    { date: "2026-11-03", name: "Independencia de Cuenca" },
    { date: "2026-12-25", name: "Navidad" },
  ]
  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { date_name: { date: new Date(h.date), name: h.name } },
      update: {},
      create: { date: new Date(h.date), name: h.name, createdBy: director.id },
    })
  }
  console.log("  ✓ Feriados 2026")

  // -------------------------------------------------------------------------
  // 6. Banco mínimo de preguntas (3 por nivel CEFR en inglés, de ejemplo)
  // -------------------------------------------------------------------------
  const enLevels = await prisma.cefrLevel.findMany({ where: { languageId: english.id } })
  for (const level of enLevels) {
    for (let i = 1; i <= 3; i++) {
      await prisma.question.create({
        data: {
          levelId: level.id,
          type: QuestionType.MULTIPLE_CHOICE,
          prompt: `[${level.code}] Sample question ${i}: choose the correct option.`,
          topic: "grammar",
          difficulty: Math.min(i, 3),
          points: 1,
          createdBy: director.id,
          options: {
            create: [
              { text: "Option A", isCorrect: true, order: 1 },
              { text: "Option B", isCorrect: false, order: 2 },
              { text: "Option C", isCorrect: false, order: 3 },
              { text: "Option D", isCorrect: false, order: 4 },
            ],
          },
        },
      })
    }
  }
  console.log("  ✓ Banco de preguntas de ejemplo")

  // -------------------------------------------------------------------------
  // 7. Plantilla de prueba de ubicación de ejemplo
  // -------------------------------------------------------------------------
  const a2 = enLevels.find((l) => l.code === "A2")
  if (a2) {
    await prisma.testTemplate.create({
      data: {
        name: "Placement Test — English A2",
        purpose: TestPurpose.PLACEMENT,
        levelId: a2.id,
        languageId: english.id,
        questionCount: 10,
        timeLimitMinutes: 30,
        instructions: "Responde todas las preguntas. No puedes volver atrás una vez enviado el examen.",
      },
    })
    console.log("  ✓ Plantilla de prueba de ubicación")
  }

  console.log("✅ Seed completo")
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
