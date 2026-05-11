/**
 * CM English Instructor — Database seed (DEV / DEMO)
 * ----------------------------------------------------------------------------
 * Popula catálogo, super admin, settings, feriados (reusable, vía helpers) y
 * además datos demo (usuarios por rol, postulaciones, estudiantes, banco
 * mínimo de preguntas, plantilla de prueba).
 *
 * Para deploy de producción, ver `prisma/seed.production.ts` que omite los
 * datos demo y toma el super admin de variables de entorno.
 *
 * Ejecución:  pnpm db:seed
 * Reset:      pnpm db:reset   (tumba, migra y vuelve a sembrar)
 */

import {
  PrismaClient,
  Role,
  QuestionType,
  TestPurpose,
  ApplicationStatus,
  UserStatus,
} from "@prisma/client"
import { hash } from "bcryptjs"
import { seedCatalog } from "./seed/catalog"
import { seedSettings } from "./seed/settings"
import { seedHolidays } from "./seed/holidays"
import { seedSuperAdmin } from "./seed/super-admin"

const prisma = new PrismaClient()
const DEMO_PASSWORD = "Demo2026!"

async function main() {
  console.log("🌱 Iniciando seed (dev/demo)...")

  // -------------------------------------------------------------------------
  // 1. Núcleo — idiomas, CEFR, catálogo
  // -------------------------------------------------------------------------
  await seedCatalog(prisma)
  console.log("  ✓ Catálogo académico")

  // -------------------------------------------------------------------------
  // 2. Super admin (en dev usamos la directora demo conocida)
  // -------------------------------------------------------------------------
  const directorId = await seedSuperAdmin(prisma, {
    email: "directora@cmenglish.test",
    password: DEMO_PASSWORD,
    firstName: "Carolina",
    lastName: "Monsalve",
    document: "1700000001",
    phone: "+593958747016",
  })

  // -------------------------------------------------------------------------
  // 3. Settings + feriados (necesitan directorId para auditoría)
  // -------------------------------------------------------------------------
  await seedSettings(prisma, directorId)
  console.log("  ✓ Configuración global")
  await seedHolidays(prisma, directorId)
  console.log("  ✓ Feriados")

  // =========================================================================
  // De acá en adelante: solo datos demo (NO ejecutar en producción)
  // =========================================================================

  const passwordHash = await hash(DEMO_PASSWORD, 10)

  // Coordinadora demo
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

  // Docente demo
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

  // Disponibilidad del docente demo: L-V 19:00-22:00 (idempotente)
  const teacherAvailabilityCount = await prisma.teacherAvailability.count({
    where: { teacherId: teacher.id },
  })
  if (teacherAvailabilityCount === 0) {
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

  console.log(`  ✓ Usuarios demo (password: ${DEMO_PASSWORD})`)

  // -------------------------------------------------------------------------
  // 4. Banco mínimo de preguntas (3 por nivel CEFR en inglés) — DEMO
  // -------------------------------------------------------------------------
  const english = await prisma.language.findUnique({ where: { code: "en" } })
  if (!english) throw new Error("Idioma 'en' no fue creado por seedCatalog")
  const enLevels = await prisma.cefrLevel.findMany({
    where: { languageId: english.id },
  })
  if ((await prisma.question.count()) === 0) {
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
            createdBy: directorId,
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
  } else {
    console.log("  ↷ Banco de preguntas ya existe — saltando")
  }

  // -------------------------------------------------------------------------
  // 5. Plantilla de prueba de ubicación de ejemplo — DEMO
  // -------------------------------------------------------------------------
  const a2 = enLevels.find((l) => l.code === "A2")
  if (a2 && (await prisma.testTemplate.count()) === 0) {
    await prisma.testTemplate.create({
      data: {
        name: "Placement Test — English A2",
        purpose: TestPurpose.PLACEMENT,
        levelId: a2.id,
        languageId: english.id,
        questionCount: 10,
        timeLimitMinutes: 30,
        instructions:
          "Responde todas las preguntas. No puedes volver atrás una vez enviado el examen.",
      },
    })
    console.log("  ✓ Plantilla de prueba de ubicación")
  }

  // -------------------------------------------------------------------------
  // 6. Postulaciones demo + estudiantes demo + docentes adicionales
  // -------------------------------------------------------------------------
  const existingApplications = await prisma.teacherApplication.count()
  if (existingApplications === 0) {
    const enLevelByCode = new Map(enLevels.map((l) => [l.code, l]))
    const lvl = (code: string) => {
      const found = enLevelByCode.get(code)
      if (!found) throw new Error(`CEFR level ${code} no encontrado`)
      return found.id
    }

    const day = (offset: number) => {
      const d = new Date()
      d.setDate(d.getDate() - offset)
      return d
    }

    const applications: Array<{
      firstName: string
      lastName: string
      email: string
      phone: string
      document: string
      bio: string
      status: ApplicationStatus
      createdAt: Date
      levelCodes: string[]
      slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>
      reviewed?: { reviewedAt: Date; rejectionReason?: string }
    }> = [
      {
        firstName: "Daniela",
        lastName: "Andrade",
        email: "daniela.andrade@example.com",
        phone: "+593987112233",
        document: "1712345601",
        bio: "Licenciada en lingüística aplicada con seis años enseñando inglés general y de negocios. Certificación TKT módulos 1-3.",
        status: ApplicationStatus.PENDING,
        createdAt: day(2),
        levelCodes: ["A1", "A2", "B1", "B2"],
        slots: [
          { dayOfWeek: 1, startTime: "07:00", endTime: "10:00" },
          { dayOfWeek: 3, startTime: "07:00", endTime: "10:00" },
          { dayOfWeek: 5, startTime: "18:00", endTime: "21:00" },
        ],
      },
      {
        firstName: "Mateo",
        lastName: "Salazar",
        email: "mateo.salazar@example.com",
        phone: "+593984556677",
        document: "1712345602",
        bio: "Traductor inglés-español con experiencia en clases ejecutivas presenciales y virtuales. Especializado en presentaciones y reuniones.",
        status: ApplicationStatus.PENDING,
        createdAt: day(5),
        levelCodes: ["B1", "B2", "C1"],
        slots: [
          { dayOfWeek: 2, startTime: "12:00", endTime: "14:00" },
          { dayOfWeek: 4, startTime: "12:00", endTime: "14:00" },
          { dayOfWeek: 6, startTime: "09:00", endTime: "12:00" },
        ],
      },
      {
        firstName: "Camila",
        lastName: "Vergara",
        email: "camila.vergara@example.com",
        phone: "+593998223344",
        document: "1712345603",
        bio: "Profesora de inglés con experiencia en niños y adolescentes. Trabajo previo en colegios bilingües y plataformas online.",
        status: ApplicationStatus.PENDING,
        createdAt: day(7),
        levelCodes: ["A1", "A2"],
        slots: [
          { dayOfWeek: 1, startTime: "15:00", endTime: "18:00" },
          { dayOfWeek: 2, startTime: "15:00", endTime: "18:00" },
          { dayOfWeek: 4, startTime: "15:00", endTime: "18:00" },
        ],
      },
      {
        firstName: "Joaquín",
        lastName: "Herrera",
        email: "joaquin.herrera@example.com",
        phone: "+593985667788",
        document: "1712345604",
        bio: "Magíster en TESOL por la Universidad Internacional. Cinco años en programas corporativos para cuentas multinacionales.",
        status: ApplicationStatus.APPROVED,
        createdAt: day(18),
        levelCodes: ["B2", "C1", "C2"],
        slots: [
          { dayOfWeek: 1, startTime: "19:00", endTime: "22:00" },
          { dayOfWeek: 3, startTime: "19:00", endTime: "22:00" },
          { dayOfWeek: 5, startTime: "19:00", endTime: "22:00" },
        ],
        reviewed: { reviewedAt: day(12) },
      },
      {
        firstName: "Renata",
        lastName: "Ocaña",
        email: "renata.ocana@example.com",
        phone: "+593967889900",
        document: "1712345605",
        bio: "Experiencia en tutorías individuales y preparación para exámenes internacionales (IELTS, TOEFL).",
        status: ApplicationStatus.PENDING,
        createdAt: day(1),
        levelCodes: ["A2", "B1", "B2"],
        slots: [
          { dayOfWeek: 6, startTime: "08:00", endTime: "13:00" },
          { dayOfWeek: 0, startTime: "09:00", endTime: "12:00" },
        ],
      },
      {
        firstName: "Sebastián",
        lastName: "Rivera",
        email: "sebastian.rivera@example.com",
        phone: "+593978445566",
        document: "1712345606",
        bio: "Tres años enseñando inglés conversacional. Cursando especialización en metodologías comunicativas.",
        status: ApplicationStatus.REJECTED,
        createdAt: day(25),
        levelCodes: ["A1", "A2"],
        slots: [
          { dayOfWeek: 2, startTime: "10:00", endTime: "12:00" },
          { dayOfWeek: 4, startTime: "10:00", endTime: "12:00" },
        ],
        reviewed: {
          reviewedAt: day(20),
          rejectionReason:
            "La disponibilidad ofrecida no coincide con la demanda actual.",
        },
      },
    ]

    for (const a of applications) {
      await prisma.teacherApplication.create({
        data: {
          firstName: a.firstName,
          lastName: a.lastName,
          email: a.email,
          phone: a.phone,
          document: a.document,
          bio: a.bio,
          status: a.status,
          createdAt: a.createdAt,
          reviewedBy: a.reviewed ? directorId : null,
          reviewedAt: a.reviewed?.reviewedAt,
          rejectionReason: a.reviewed?.rejectionReason,
          appliedLevels: {
            create: a.levelCodes.map((code) => ({ levelId: lvl(code) })),
          },
          proposedAvailability: {
            create: a.slots,
          },
        },
      })
    }
    console.log(`  ✓ Postulaciones de docentes (${applications.length})`)
  } else {
    console.log(`  ↷ Postulaciones ya existen (${existingApplications}) — saltando`)
  }

  // Estudiantes demo
  const dayAgo = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() - offset)
    return d
  }
  const students: Array<{
    email: string
    firstName: string
    lastName: string
    document: string
    phone: string
    status: UserStatus
    company?: string
    position?: string
    notes?: string
    createdAt: Date
    schedule: Array<{ dayOfWeek: number; startTime: string; endTime: string }>
  }> = [
    { email: "lucia.torres@example.com", firstName: "Lucía", lastName: "Torres", document: "1722334411", phone: "+593987001122", status: UserStatus.ACTIVE, company: "Banco Pichincha", position: "Subgerente de Riesgos", notes: "Necesita inglés conversacional para reuniones internacionales.", createdAt: dayAgo(75), schedule: [{ dayOfWeek: 2, startTime: "07:00", endTime: "08:30" }, { dayOfWeek: 4, startTime: "07:00", endTime: "08:30" }] },
    { email: "andres.cabrera@example.com", firstName: "Andrés", lastName: "Cabrera", document: "1722334412", phone: "+593984009988", status: UserStatus.ACTIVE, company: "Pacifictel", position: "Director Comercial", notes: "Requiere foco en negociación y presentaciones.", createdAt: dayAgo(60), schedule: [{ dayOfWeek: 1, startTime: "18:00", endTime: "19:30" }, { dayOfWeek: 3, startTime: "18:00", endTime: "19:30" }] },
    { email: "valeria.quispe@example.com", firstName: "Valeria", lastName: "Quispe", document: "1722334413", phone: "+593997776655", status: UserStatus.ACTIVE, company: "Consultora Andina", position: "Auditora Senior", createdAt: dayAgo(40), schedule: [{ dayOfWeek: 1, startTime: "12:30", endTime: "13:30" }, { dayOfWeek: 2, startTime: "12:30", endTime: "13:30" }, { dayOfWeek: 5, startTime: "12:30", endTime: "13:30" }] },
    { email: "matias.lopez@example.com", firstName: "Matías", lastName: "López", document: "1722334414", phone: "+593983221100", status: UserStatus.ACTIVE, notes: "Estudiante adolescente preparándose para examen Cambridge B1.", createdAt: dayAgo(30), schedule: [{ dayOfWeek: 1, startTime: "16:00", endTime: "17:00" }, { dayOfWeek: 3, startTime: "16:00", endTime: "17:00" }, { dayOfWeek: 5, startTime: "16:00", endTime: "17:00" }] },
    { email: "paula.benitez@example.com", firstName: "Paula", lastName: "Benítez", document: "1722334415", phone: "+593990112233", status: UserStatus.ACTIVE, company: "Marathon Sports", position: "Coordinadora de Marketing", createdAt: dayAgo(22), schedule: [{ dayOfWeek: 6, startTime: "09:00", endTime: "11:00" }] },
    { email: "ricardo.morales@example.com", firstName: "Ricardo", lastName: "Morales", document: "1722334416", phone: "+593976543210", status: UserStatus.PENDING_APPROVAL, company: "Logística Express", position: "Jefe de Operaciones", notes: "Pendiente de cargar resultado de prueba de ubicación.", createdAt: dayAgo(8), schedule: [{ dayOfWeek: 2, startTime: "19:00", endTime: "20:30" }, { dayOfWeek: 4, startTime: "19:00", endTime: "20:30" }] },
    { email: "sofia.herrera@example.com", firstName: "Sofía", lastName: "Herrera", document: "1722334417", phone: "+593984455667", status: UserStatus.PENDING_APPROVAL, createdAt: dayAgo(3), schedule: [{ dayOfWeek: 0, startTime: "10:00", endTime: "12:00" }] },
    { email: "fernando.guzman@example.com", firstName: "Fernando", lastName: "Guzmán", document: "1722334418", phone: "+593978332211", status: UserStatus.INACTIVE, company: "Pronaca", position: "Analista Financiero", notes: "Pausado a pedido del estudiante por viaje. Reanudar en próximo trimestre.", createdAt: dayAgo(180), schedule: [] },
    { email: "isabel.delgado@example.com", firstName: "Isabel", lastName: "Delgado", document: "1722334419", phone: "+593985665544", status: UserStatus.ACTIVE, company: "Universidad San Francisco", position: "Docente Asociada", createdAt: dayAgo(95), schedule: [{ dayOfWeek: 3, startTime: "08:00", endTime: "09:30" }, { dayOfWeek: 5, startTime: "08:00", endTime: "09:30" }] },
    { email: "diego.paez@example.com", firstName: "Diego", lastName: "Páez", document: "1722334420", phone: "+593983998877", status: UserStatus.ACTIVE, company: "Movistar Ecuador", position: "Product Manager", createdAt: dayAgo(50), schedule: [{ dayOfWeek: 1, startTime: "20:00", endTime: "21:30" }, { dayOfWeek: 4, startTime: "20:00", endTime: "21:30" }] },
  ]

  // Docentes adicionales (idempotente)
  const teacherLevelsCount = await prisma.teacherLevel.count()
  if (teacherLevelsCount === 0) {
    const enLvl = (code: string) => {
      const found = enLevels.find((l) => l.code === code)
      if (!found) throw new Error(`CEFR EN ${code} no encontrado`)
      return found.id
    }
    await prisma.teacherLevel.createMany({
      data: ["A1", "A2", "B1", "B2", "C1"].map((c) => ({
        teacherId: teacher.id,
        levelId: enLvl(c),
      })),
    })

    const teacher2 = await prisma.user.upsert({
      where: { email: "docente2@cmenglish.test" },
      update: {},
      create: {
        email: "docente2@cmenglish.test",
        passwordHash,
        firstName: "Esteban",
        lastName: "Vinueza",
        role: Role.TEACHER,
        document: "1700000010",
        teacherProfile: {
          create: {
            hireDate: new Date(),
            hourlyRate: 16.0,
            bio: "Docente con experiencia corporativa y preparación para exámenes Cambridge.",
            isActive: true,
            availability: {
              create: [
                { dayOfWeek: 1, startTime: "07:00", endTime: "10:00" },
                { dayOfWeek: 2, startTime: "07:00", endTime: "10:00" },
                { dayOfWeek: 3, startTime: "07:00", endTime: "10:00" },
                { dayOfWeek: 4, startTime: "12:00", endTime: "14:00" },
                { dayOfWeek: 5, startTime: "12:00", endTime: "14:00" },
              ],
            },
          },
        },
      },
    })
    await prisma.teacherLevel.createMany({
      data: ["A1", "A2", "B1", "B2"].map((c) => ({
        teacherId: teacher2.id,
        levelId: enLvl(c),
      })),
    })

    const teacher3 = await prisma.user.upsert({
      where: { email: "docente3@cmenglish.test" },
      update: {},
      create: {
        email: "docente3@cmenglish.test",
        passwordHash,
        firstName: "Camila",
        lastName: "Rosero",
        role: Role.TEACHER,
        document: "1700000011",
        teacherProfile: {
          create: {
            hireDate: new Date(),
            hourlyRate: 18.0,
            bio: "Especialista en niveles avanzados y traducción profesional.",
            isActive: true,
            availability: {
              create: [
                { dayOfWeek: 0, startTime: "09:00", endTime: "12:00" },
                { dayOfWeek: 6, startTime: "08:00", endTime: "13:00" },
                { dayOfWeek: 1, startTime: "15:00", endTime: "18:00" },
                { dayOfWeek: 3, startTime: "15:00", endTime: "18:00" },
              ],
            },
          },
        },
      },
    })
    await prisma.teacherLevel.createMany({
      data: ["B1", "B2", "C1", "C2"].map((c) => ({
        teacherId: teacher3.id,
        levelId: enLvl(c),
      })),
    })

    console.log("  ✓ Docentes adicionales + cobertura CEFR")
  }

  let createdStudents = 0
  for (const s of students) {
    const result = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        passwordHash,
        firstName: s.firstName,
        lastName: s.lastName,
        document: s.document,
        phone: s.phone,
        role: Role.STUDENT,
        status: s.status,
        createdAt: s.createdAt,
        studentProfile: {
          create: {
            company: s.company,
            position: s.position,
            notes: s.notes,
          },
        },
      },
    })
    if (result.createdAt.getTime() === s.createdAt.getTime()) createdStudents++
  }
  console.log(`  ✓ Estudiantes demo (${createdStudents} nuevos / ${students.length} total)`)

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
