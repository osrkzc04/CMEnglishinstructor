/**
 * Wipe del banco de preguntas + todo el rastro de evaluaciones que cuelga.
 *
 * Pensado para preparar la carga inicial: deja en cero las tablas que
 * referencian (directa o indirectamente) a `Question`, así el importador
 * arranca contra un nivel limpio.
 *
 * Se vacían (en orden FK-safe):
 *   - PlacementSkillEvaluation
 *   - TestSessionEvent
 *   - TestSessionQuestion
 *   - TestSession
 *   - InviteToken
 *   - QuestionOption
 *   - QuestionFillAnswer
 *   - Question
 *
 * Se preserva:
 *   - El catálogo CEFR (CefrLevel) y los demás bloques del catálogo.
 *   - TestTemplate / TestTemplateSection / TestTemplateTopic (la definición
 *     de la prueba en sí — no depende de las preguntas concretas).
 *   - Enrollments — pero a las que tenían `placementTestId` apuntando a una
 *     sesión, se les setea a null antes de borrar.
 *
 * Ejecución:
 *   pnpm tsx scripts/wipe-questions.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🧹 Wipe del banco de preguntas + historial de evaluaciones\n")

  const before = await snapshot()
  printSnapshot("Antes:", before)

  await prisma.$transaction(async (tx) => {
    // Enrollments que apuntan a una TestSession via placementTestId — soltar
    // el vínculo antes de borrar TestSession para no romper la FK.
    const updated = await tx.enrollment.updateMany({
      where: { placementTestId: { not: null } },
      data: { placementTestId: null },
    })
    if (updated.count > 0) {
      console.log(`  ✓ ${updated.count} enrollments con placementTestId reseteado`)
    }

    // PlacementSkillEvaluation (también cascadea desde TestSession, pero borramos
    // explícito para que el conteo aparezca en logs).
    const skill = await tx.placementSkillEvaluation.deleteMany({})
    if (skill.count > 0) {
      console.log(`  ✓ ${skill.count} PlacementSkillEvaluation eliminadas`)
    }

    // Eventos de sesión.
    const events = await tx.testSessionEvent.deleteMany({})
    if (events.count > 0) {
      console.log(`  ✓ ${events.count} TestSessionEvent eliminados`)
    }

    // Preguntas de sesión (snapshots).
    const sessionQs = await tx.testSessionQuestion.deleteMany({})
    if (sessionQs.count > 0) {
      console.log(`  ✓ ${sessionQs.count} TestSessionQuestion eliminados`)
    }

    // Sesiones de prueba.
    const sessions = await tx.testSession.deleteMany({})
    if (sessions.count > 0) {
      console.log(`  ✓ ${sessions.count} TestSession eliminadas`)
    }

    // Invites.
    const invites = await tx.inviteToken.deleteMany({})
    if (invites.count > 0) {
      console.log(`  ✓ ${invites.count} InviteToken eliminados`)
    }

    // Opciones MC (también cascadea desde Question — explícito para logs).
    const options = await tx.questionOption.deleteMany({})
    if (options.count > 0) {
      console.log(`  ✓ ${options.count} QuestionOption eliminadas`)
    }

    // Respuestas aceptadas FILL_IN.
    const fillAnswers = await tx.questionFillAnswer.deleteMany({})
    if (fillAnswers.count > 0) {
      console.log(`  ✓ ${fillAnswers.count} QuestionFillAnswer eliminadas`)
    }

    // Preguntas (parent).
    const questions = await tx.question.deleteMany({})
    if (questions.count > 0) {
      console.log(`  ✓ ${questions.count} Question eliminadas`)
    }
  })

  const after = await snapshot()
  console.log("")
  printSnapshot("Después:", after)

  console.log("\n✅ Wipe completo — banco listo para la carga inicial.")
}

async function snapshot() {
  const [
    questions,
    options,
    fillAnswers,
    invites,
    sessions,
    sessionQs,
    events,
    skill,
    enrollmentsLinkedToTest,
    cefrLevels,
    templates,
  ] = await Promise.all([
    prisma.question.count(),
    prisma.questionOption.count(),
    prisma.questionFillAnswer.count(),
    prisma.inviteToken.count(),
    prisma.testSession.count(),
    prisma.testSessionQuestion.count(),
    prisma.testSessionEvent.count(),
    prisma.placementSkillEvaluation.count(),
    prisma.enrollment.count({ where: { placementTestId: { not: null } } }),
    prisma.cefrLevel.count(),
    prisma.testTemplate.count(),
  ])
  return {
    questions,
    options,
    fillAnswers,
    invites,
    sessions,
    sessionQs,
    events,
    skill,
    enrollmentsLinkedToTest,
    cefrLevels,
    templates,
  }
}

function printSnapshot(label: string, s: Awaited<ReturnType<typeof snapshot>>) {
  console.log(label)
  console.log("  Se vacían:")
  console.log(`    Question                  = ${s.questions}`)
  console.log(`    QuestionOption            = ${s.options}`)
  console.log(`    QuestionFillAnswer        = ${s.fillAnswers}`)
  console.log(`    InviteToken               = ${s.invites}`)
  console.log(`    TestSession               = ${s.sessions}`)
  console.log(`    TestSessionQuestion       = ${s.sessionQs}`)
  console.log(`    TestSessionEvent          = ${s.events}`)
  console.log(`    PlacementSkillEvaluation  = ${s.skill}`)
  console.log(`    Enrollments con placementTestId = ${s.enrollmentsLinkedToTest}`)
  console.log("  Se preservan:")
  console.log(`    CefrLevel                 = ${s.cefrLevels}`)
  console.log(`    TestTemplate              = ${s.templates}`)
}

main()
  .catch((err) => {
    console.error("\n✗ Error:", err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
