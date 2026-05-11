/**
 * Wipe operativo de la base de datos.
 *
 * Borra todos los datos transaccionales (estudiantes, docentes,
 * postulaciones y todo lo que les cuelga) preservando:
 *   - El usuario directora@cmenglish.test
 *   - Catálogo (idiomas, niveles CEFR, cursos, programas, niveles)
 *   - Settings y feriados
 *   - Repositorio de materiales
 *   - Banco de preguntas y plantillas de prueba
 *   - Histórico de AuditLog
 *
 * Se elimina:
 *   - Aulas, slots, sesiones, participantes, bitácoras, asignaciones
 *   - Matrículas
 *   - Sesiones de prueba + invite tokens
 *   - Postulaciones de docente + niveles + disponibilidad
 *   - Perfiles docente/estudiante + sus disponibilidades/horarios
 *   - Tokens de NextAuth (pending activations / resets)
 *   - Notificaciones de email
 *   - Todos los Users con email distinto a directora@cmenglish.test
 *
 * Ejecución:
 *   pnpm tsx scripts/wipe-operational.ts
 *
 * Para correr otra cuenta como "preservada", exportar KEEP_EMAIL antes:
 *   KEEP_EMAIL="otra@cuenta.test" pnpm tsx scripts/wipe-operational.ts
 */

import { PrismaClient } from "@prisma/client"

const KEEP_EMAIL = process.env.KEEP_EMAIL ?? "directora@cmenglish.test"

const prisma = new PrismaClient()

async function main() {
  console.log(`🧹 Wipe operativo — preservando solo ${KEEP_EMAIL}\n`)

  const keep = await prisma.user.findUnique({
    where: { email: KEEP_EMAIL },
    select: { id: true, firstName: true, lastName: true, role: true },
  })
  if (!keep) {
    throw new Error(
      `Usuario ${KEEP_EMAIL} no existe. Ejecuta pnpm db:seed primero o ` +
        `cambia la variable KEEP_EMAIL.`,
    )
  }
  console.log(`  ✓ Usuario a preservar: ${keep.firstName} ${keep.lastName} (${keep.role})\n`)

  // Conteo previo (informativo).
  const before = await snapshot()
  printSnapshot("Antes:", before)

  // Borrado en orden FK-safe. La transacción asegura atomicidad — si algún
  // delete falla, nada queda a medias.
  await prisma.$transaction(async (tx) => {
    // 1. Bitácoras + participantes + sesiones de clase (children primero).
    await tx.classLog.deleteMany({})
    await tx.classParticipant.deleteMany({})
    await tx.classSession.deleteMany({})

    // 2. Asignaciones de docente, slots, aulas.
    await tx.teacherAssignment.deleteMany({})
    await tx.classGroupSlot.deleteMany({})
    await tx.classGroup.deleteMany({})

    // 3. Matrículas.
    await tx.enrollment.deleteMany({})

    // 4. Pruebas de nivel — eventos → preguntas → sesiones → invites.
    await tx.testSessionEvent.deleteMany({})
    await tx.testSessionQuestion.deleteMany({})
    await tx.testSession.deleteMany({})
    await tx.inviteToken.deleteMany({})

    // 5. Postulaciones de docente con sus dependencias.
    await tx.applicationAvailability.deleteMany({})
    await tx.teacherApplicationLevel.deleteMany({})
    await tx.teacherApplication.deleteMany({})

    // 6. Perfiles + horarios/disponibilidades. Las cascadas declaradas en
    //    el schema cubrirían esto al borrar User, pero borrar explícito es
    //    defensivo (y permite ver el conteo en logs si se agrega después).
    await tx.studentPreferredSchedule.deleteMany({})
    await tx.teacherUnavailability.deleteMany({})
    await tx.teacherAvailability.deleteMany({})
    await tx.teacherLevel.deleteMany({})
    await tx.teacherProfile.deleteMany({})
    await tx.studentProfile.deleteMany({})

    // 7. Tokens NextAuth (invitaciones de activación, resets pendientes).
    await tx.verificationToken.deleteMany({})

    // 8. Notificaciones de email — incluye consultas del form de contacto y
    //    correos transaccionales. Se borran por completo (incluso huérfanos
    //    sin userId, como las consultas del landing).
    await tx.emailNotification.deleteMany({})

    // 9. Finalmente Users — Account/Session cascadean por FK del schema.
    const deleted = await tx.user.deleteMany({
      where: { email: { not: KEEP_EMAIL } },
    })
    console.log(`  ✓ ${deleted.count} usuarios eliminados (excepto ${KEEP_EMAIL})\n`)
  })

  const after = await snapshot()
  printSnapshot("Después:", after)

  console.log(`\n✅ Wipe operativo completo. Preservado: ${KEEP_EMAIL}`)
}

// ----------------------------------------------------------------------------
//  Helpers
// ----------------------------------------------------------------------------

async function snapshot() {
  const [
    users,
    teacherProfiles,
    studentProfiles,
    teacherApplications,
    classGroups,
    classSessions,
    enrollments,
    testSessions,
    languages,
    courses,
    programLevels,
    settings,
    questions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.teacherProfile.count(),
    prisma.studentProfile.count(),
    prisma.teacherApplication.count(),
    prisma.classGroup.count(),
    prisma.classSession.count(),
    prisma.enrollment.count(),
    prisma.testSession.count(),
    prisma.language.count(),
    prisma.course.count(),
    prisma.programLevel.count(),
    prisma.appSetting.count(),
    prisma.question.count(),
  ])
  return {
    users,
    teacherProfiles,
    studentProfiles,
    teacherApplications,
    classGroups,
    classSessions,
    enrollments,
    testSessions,
    languages,
    courses,
    programLevels,
    settings,
    questions,
  }
}

function printSnapshot(label: string, s: Awaited<ReturnType<typeof snapshot>>) {
  console.log(`${label}`)
  console.log(`  Operativo:`)
  console.log(`    users               = ${s.users}`)
  console.log(`    teacherProfiles     = ${s.teacherProfiles}`)
  console.log(`    studentProfiles     = ${s.studentProfiles}`)
  console.log(`    teacherApplications = ${s.teacherApplications}`)
  console.log(`    classGroups         = ${s.classGroups}`)
  console.log(`    classSessions       = ${s.classSessions}`)
  console.log(`    enrollments         = ${s.enrollments}`)
  console.log(`    testSessions        = ${s.testSessions}`)
  console.log(`  Preservado:`)
  console.log(`    languages           = ${s.languages}`)
  console.log(`    courses             = ${s.courses}`)
  console.log(`    programLevels       = ${s.programLevels}`)
  console.log(`    appSettings         = ${s.settings}`)
  console.log(`    questions           = ${s.questions}`)
}

main()
  .catch((err) => {
    console.error("\n✗ Error:", err.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
