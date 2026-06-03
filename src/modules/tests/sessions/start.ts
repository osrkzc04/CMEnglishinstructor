import "server-only"
import { Prisma, type TestSession } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  DeviceMismatchError,
  InviteExpiredError,
  InviteNotFoundError,
  InvalidStateError,
} from "./errors"
import {
  checkDeviceAccess,
  fingerprint,
  generateDeviceSecret,
  hashDeviceSecret,
} from "./device-lock"
import { logSessionEvent } from "./log-event"
import { sampleQuestionsForPlacement } from "./sampling"
import type { Section } from "../shared/types"

/**
 * Inicia o retoma una sesión de placement test.
 *
 * Llamado por `POST /api/test-sessions/start` con `{ token }`. Devuelve la
 * info necesaria para que el route handler:
 *   - setee la cookie de dispositivo (solo si es alta nueva).
 *   - redirija al cliente a `/prueba/[token]/rendir`.
 *
 * Sin auth — el token de la URL ES la auth.
 */

export type StartSessionArgs = {
  token: string
  userAgent: string | null
  ip: string | null
  existingDeviceCookie: string | null
}

export type StartSessionResult = {
  sessionId: string
  deadline: Date
  resumed: boolean
  // Si es una alta nueva (no resume), el route handler debe setear la cookie
  // con este valor. En resume es null porque la cookie ya está seteada.
  cookieToSet: string | null
}

export async function startPlacementSession(args: StartSessionArgs): Promise<StartSessionResult> {
  return await prisma.$transaction(
    async (tx) => {
      const invite = await tx.inviteToken.findUnique({
        where: { token: args.token },
        include: {
          session: true,
          template: {
            include: {
              sections: {
                include: { level: { select: { id: true, code: true } } },
                orderBy: { order: "asc" },
              },
            },
          },
        },
      })

      if (!invite) throw new InviteNotFoundError()
      if (invite.template.purpose !== "PLACEMENT") {
        throw new InvalidStateError("Esta plantilla no es de placement test")
      }

      const session = invite.session

      // 1) Resume si ya hay sesión activa (IN_PROGRESS o PENDING_WRITING).
      //    Ambos estados son no-terminales — el candidato puede volver y
      //    seguir respondiendo / enviar el writing.
      if (session && (session.status === "IN_PROGRESS" || session.status === "PENDING_WRITING")) {
        const check = checkDeviceAccess({
          cookieHashOnSession: session.deviceCookieHash,
          fingerprintOnSession: session.deviceFingerprint,
          cookieValueFromRequest: args.existingDeviceCookie,
          userAgentFromRequest: args.userAgent,
          ipFromRequest: args.ip,
        })
        if (!check.ok) {
          throw new DeviceMismatchError(check.reason)
        }
        return {
          sessionId: session.id,
          deadline: session.deadline,
          resumed: true,
          cookieToSet: null,
          missingReadingLevels: [] as string[],
        }
      }

      // 2) Si hay sesión terminal, no se reinicia.
      if (session) {
        throw new InvalidStateError("La evaluación ya fue rendida")
      }

      // 3) Token expirado sin sesión iniciada.
      if (invite.expiresAt < new Date()) {
        throw new InviteExpiredError()
      }

      // 4) Alta nueva: sample + crear sesión + snapshot.
      if (invite.template.sections.length === 0) {
        throw new InvalidStateError(
          "La plantilla no tiene secciones configuradas — coordina la carga antes de invitar",
        )
      }

      const sections: Section[] = invite.template.sections.map((s) => ({
        order: s.order,
        levelId: s.levelId,
        cefrLevelCode: s.level.code,
        samplePoolSize: s.samplePoolSize,
        questionCount: s.questionCount,
        passingPercent: s.passingPercent,
      }))

      const { questions: sampled, missingReadingLevels } = await sampleQuestionsForPlacement(
        tx,
        sections,
      )

      const now = new Date()
      const deadline = new Date(now.getTime() + invite.template.timeLimitMinutes * 60_000)

      // Device lock — generar antes de crear la sesión para que el create
      // ya los persista. El secreto plain se devuelve solo en memoria al
      // route handler (no se persiste en DB).
      const secret = generateDeviceSecret()
      const cookieHash = hashDeviceSecret(secret)
      const fp = fingerprint(args.userAgent, args.ip)

      const created = await tx.testSession.create({
        data: {
          inviteId: invite.id,
          templateId: invite.templateId,
          candidateName: invite.candidateName,
          candidateEmail: invite.candidateEmail,
          startedAt: now,
          deadline,
          status: "IN_PROGRESS",
          currentSectionOrder: 1,
          deviceCookieHash: cookieHash,
          deviceFingerprint: fp,
        },
        select: { id: true, deadline: true },
      })

      await tx.testSessionQuestion.createMany({
        data: sampled.map((q, idx) => ({
          sessionId: created.id,
          order: idx + 1,
          questionId: q.questionId,
          promptSnapshot: q.prompt,
          typeSnapshot: q.type,
          pointsSnapshot: q.points,
          optionsSnapshot: q.options
            ? (q.options as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          acceptedAnswersSnapshot: q.acceptedAnswers
            ? (q.acceptedAnswers as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          cefrLevelCode: q.cefrLevelCode,
          sectionOrder: q.sectionOrder,
        })),
      })

      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { usedAt: now },
      })

      return {
        sessionId: created.id,
        deadline: created.deadline,
        resumed: false,
        cookieToSet: secret,
        missingReadingLevels,
      }
    },
    { maxWait: 10_000, timeout: 30_000 },
  ).then(async (result) => {
    // Log fuera del tx (sigue el patrón de logSessionEvent usado en el
    // resto del módulo, que escribe con el prisma global). Esto no
    // bloquea al candidato — los eventos son señal para coordinación.
    if (!result.resumed && result.missingReadingLevels.length > 0) {
      await Promise.all(
        result.missingReadingLevels.map((cefr) =>
          logSessionEvent({
            sessionId: result.sessionId,
            type: "MISSING_READING",
            metadata: { cefrLevelCode: cefr },
          }),
        ),
      )
    }
    return {
      sessionId: result.sessionId,
      deadline: result.deadline,
      resumed: result.resumed,
      cookieToSet: result.cookieToSet,
    }
  })
}

// -----------------------------------------------------------------------------
//  Lookup para que el route handler valide token sin abrir transacción.
// -----------------------------------------------------------------------------

export async function getInviteByToken(token: string): Promise<{
  id: string
  candidateName: string
  candidateEmail: string
  expiresAt: Date
  usedAt: Date | null
  templateId: string
  templateName: string
  timeLimitMinutes: number
  session: Pick<TestSession, "id" | "status" | "deadline"> | null
} | null> {
  const invite = await prisma.inviteToken.findUnique({
    where: { token },
    select: {
      id: true,
      candidateName: true,
      candidateEmail: true,
      expiresAt: true,
      usedAt: true,
      templateId: true,
      template: { select: { name: true, timeLimitMinutes: true } },
      session: { select: { id: true, status: true, deadline: true } },
    },
  })
  if (!invite) return null
  return {
    id: invite.id,
    candidateName: invite.candidateName,
    candidateEmail: invite.candidateEmail,
    expiresAt: invite.expiresAt,
    usedAt: invite.usedAt,
    templateId: invite.templateId,
    templateName: invite.template.name,
    timeLimitMinutes: invite.template.timeLimitMinutes,
    session: invite.session,
  }
}
