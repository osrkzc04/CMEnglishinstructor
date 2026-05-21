import "server-only"
import { EmailStatus, EmailType, Modality } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { emailProvider } from "@/lib/email"
import { env } from "@/lib/env"
import { EMAIL_COLORS, EMAIL_FONTS, renderEmail, type EmailBlock } from "@/lib/email/template"

/**
 * Emails de asignación de aula. Se envían cuando coordinación cierra el
 * triángulo {aula, docente, estudiante}: alta del aula con ambos cargados,
 * suma de un alumno a un aula con docente, o cambio de docente en un aula
 * con alumnos.
 *
 * El email es un snapshot — toma los datos al momento de enviar y los
 * congela en `templateData.html`. Si después se cambia el aula, el correo
 * que llegó sigue siendo el original.
 */

const DAYS_ES_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

const MODALITY_LABEL: Record<Modality, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrida",
}

export type ClassGroupAssignmentSnapshot = {
  classGroupId: string
  classGroupName: string
  programLabel: string
  modality: Modality
  defaultMeetingUrl: string | null
  defaultLocation: string | null
  slots: { dayOfWeek: number; startTime: string; durationMinutes: number }[]
  teacher: { id: string; firstName: string; lastName: string }
}

// -----------------------------------------------------------------------------
//  Carga del snapshot — usado por las acciones que disparan el email
// -----------------------------------------------------------------------------

export async function loadClassGroupAssignmentSnapshot(
  classGroupId: string,
): Promise<ClassGroupAssignmentSnapshot | null> {
  const row = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    select: {
      id: true,
      name: true,
      modality: true,
      defaultMeetingUrl: true,
      defaultLocation: true,
      programLevel: {
        select: {
          name: true,
          program: {
            select: { name: true, course: { select: { name: true } } },
          },
        },
      },
      slots: {
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        select: { dayOfWeek: true, startTime: true, durationMinutes: true },
      },
      teacherAssignments: {
        where: { endDate: null },
        take: 1,
        select: {
          teacher: {
            select: {
              userId: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  })
  if (!row) return null
  const assignment = row.teacherAssignments[0]
  if (!assignment) return null

  return {
    classGroupId: row.id,
    classGroupName: row.name,
    programLabel: `${row.programLevel.program.course.name} · ${row.programLevel.program.name} · ${row.programLevel.name}`,
    modality: row.modality,
    defaultMeetingUrl: row.defaultMeetingUrl,
    defaultLocation: row.defaultLocation,
    slots: row.slots,
    teacher: {
      id: assignment.teacher.userId,
      firstName: assignment.teacher.user.firstName,
      lastName: assignment.teacher.user.lastName,
    },
  }
}

// -----------------------------------------------------------------------------
//  Envío
// -----------------------------------------------------------------------------

type SendArgs = {
  to: string
  recipientName: string
  recipientUserId: string
  audience: "teacher" | "student"
  /** Lista de nombres de los compañeros (no incluye al destinatario). */
  classmateNames: string[]
  snapshot: ClassGroupAssignmentSnapshot
}

export async function sendClassGroupAssignmentEmail(args: SendArgs): Promise<{ ok: boolean }> {
  const html = buildHtml(args)
  const subject = `${args.audience === "teacher" ? "Aula asignada" : "Tu nueva aula"} — ${args.snapshot.classGroupName}`
  const type =
    args.audience === "teacher"
      ? EmailType.CLASS_GROUP_ASSIGNED_TEACHER
      : EmailType.CLASS_GROUP_ASSIGNED_STUDENT

  const notif = await prisma.emailNotification.create({
    data: {
      to: args.to,
      subject,
      type,
      userId: args.recipientUserId,
      templateData: {
        kind: type,
        classGroupId: args.snapshot.classGroupId,
        html,
        from: env.EMAIL_FROM,
        replyTo: env.EMAIL_REPLY_TO ?? null,
      },
      status: EmailStatus.QUEUED,
    },
  })

  try {
    await emailProvider().send({
      to: args.to,
      subject,
      html,
      from: env.EMAIL_FROM,
      replyTo: env.EMAIL_REPLY_TO,
    })
    await prisma.emailNotification.update({
      where: { id: notif.id },
      data: { status: EmailStatus.SENT, sentAt: new Date(), attempts: 1 },
    })
    return { ok: true }
  } catch (err) {
    await prisma.emailNotification.update({
      where: { id: notif.id },
      data: {
        status: EmailStatus.FAILED,
        error: err instanceof Error ? err.message : String(err),
        attempts: 1,
      },
    })
    return { ok: false }
  }
}

// -----------------------------------------------------------------------------
//  Helper: notificar a docente + N estudiantes
// -----------------------------------------------------------------------------

/**
 * Envía el correo de asignación a todos los actores del aula. No falla la
 * llamada si un envío individual rompe — los errores quedan registrados en
 * `EmailNotification` y se pueden reintentar.
 *
 * @param classGroupId aula
 * @param teacherIncluded si false, solo notifica a estudiantes (útil cuando
 *   solo se sumó un alumno y el docente ya estaba notificado).
 * @param studentIds lista explícita de userIds de estudiantes a notificar;
 *   si no se pasa, se notifican todos los estudiantes con matrícula ACTIVE
 *   en el aula al momento de la consulta.
 */
export async function notifyClassGroupAssignment(args: {
  classGroupId: string
  teacherIncluded?: boolean
  studentIds?: string[]
}): Promise<{ teacherSent: boolean; studentsSent: number }> {
  const snapshot = await loadClassGroupAssignmentSnapshot(args.classGroupId)
  if (!snapshot) {
    return { teacherSent: false, studentsSent: 0 }
  }

  // Lookup recipients para no dejar info sensible en `snapshot`.
  const recipients = await prisma.user.findMany({
    where: {
      OR: [
        { id: snapshot.teacher.id },
        ...(args.studentIds && args.studentIds.length > 0
          ? [{ id: { in: args.studentIds } }]
          : [
              {
                role: "STUDENT" as const,
                studentProfile: {
                  enrollments: {
                    some: { classGroupId: snapshot.classGroupId, status: "ACTIVE" as const },
                  },
                },
              },
            ]),
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  })

  const teacher = recipients.find((r) => r.id === snapshot.teacher.id)
  const students = recipients.filter((r) => r.id !== snapshot.teacher.id)
  const allStudentNames = students.map((s) => `${s.firstName} ${s.lastName}`)

  let teacherSent = false
  let studentsSent = 0

  if (teacher && args.teacherIncluded !== false) {
    const result = await sendClassGroupAssignmentEmail({
      to: teacher.email,
      recipientName: teacher.firstName,
      recipientUserId: teacher.id,
      audience: "teacher",
      classmateNames: allStudentNames,
      snapshot,
    })
    teacherSent = result.ok
  }

  for (const s of students) {
    const others = allStudentNames.filter((n) => n !== `${s.firstName} ${s.lastName}`)
    const result = await sendClassGroupAssignmentEmail({
      to: s.email,
      recipientName: s.firstName,
      recipientUserId: s.id,
      audience: "student",
      classmateNames: others,
      snapshot,
    })
    if (result.ok) studentsSent += 1
  }

  return { teacherSent, studentsSent }
}

// -----------------------------------------------------------------------------
//  HTML — copy editorial corto, tono cálido pero no infantil
// -----------------------------------------------------------------------------

function buildHtml(args: SendArgs): string {
  const { audience, snapshot, recipientName, classmateNames } = args
  const teacherName = `${snapshot.teacher.firstName} ${snapshot.teacher.lastName}`
  const showMeeting =
    snapshot.modality === Modality.VIRTUAL || snapshot.modality === Modality.HIBRIDO
  const showLocation =
    snapshot.modality === Modality.PRESENCIAL || snapshot.modality === Modality.HIBRIDO

  const scheduleBlock = renderScheduleBlock(snapshot.slots)
  const locationLine =
    showLocation && snapshot.defaultLocation
      ? `Ubicación: <strong>${escape(snapshot.defaultLocation)}</strong>`
      : null

  const baseUrl = env.AUTH_URL.replace(/\/$/, "")
  const ctaUrl =
    audience === "teacher" ? `${baseUrl}/docente/dashboard` : `${baseUrl}/estudiante/dashboard`
  const ctaLabel = audience === "teacher" ? "Abrir mi panel del docente" : "Ir a mi panel"

  const blocks: EmailBlock[] = []
  const para = (html: string): EmailBlock => ({ kind: "p", html })
  const raw = (html: string): EmailBlock => ({ kind: "raw", html })

  if (audience === "teacher") {
    blocks.push(para(`Hola, ${escape(recipientName)}.`))
    blocks.push(
      para(
        `Coordinación te asignó al aula <strong>${escape(snapshot.classGroupName)}</strong> (${escape(snapshot.programLabel)}). Modalidad: <strong>${MODALITY_LABEL[snapshot.modality]}</strong>.`,
      ),
    )
    blocks.push(raw(scheduleBlock))
    if (classmateNames.length > 0) {
      blocks.push(
        para(
          classmateNames.length === 1
            ? `Tu estudiante será <strong>${escape(classmateNames[0]!)}</strong>.`
            : `Tus estudiantes serán: ${classmateNames.map((n) => `<strong>${escape(n)}</strong>`).join(", ")}.`,
        ),
      )
    }
    if (locationLine) blocks.push(para(locationLine))
    if (showMeeting) {
      blocks.push(
        para(
          "Para las clases virtuales, carga el enlace de la videollamada desde tu panel — se aplica a todas las sesiones del aula y los alumnos lo verán al conectarse.",
        ),
      )
    }
    blocks.push(
      para(
        "Entra a tu panel para revisar el detalle del aula, los estudiantes asignados y los materiales del nivel.",
      ),
    )
    blocks.push(para("Cualquier ajuste, escríbenos."))
  } else {
    blocks.push(para(`Hola, ${escape(recipientName)}.`))
    blocks.push(
      para(
        `Quedó armada tu aula <strong>${escape(snapshot.classGroupName)}</strong> (${escape(snapshot.programLabel)}). Vas a tomar clases con <strong>${escape(teacherName)}</strong>. Modalidad: <strong>${MODALITY_LABEL[snapshot.modality]}</strong>.`,
      ),
    )
    blocks.push(raw(scheduleBlock))
    if (locationLine) blocks.push(para(locationLine))
    if (showMeeting) {
      blocks.push(
        para(
          `${escape(teacherName)} te ha compartido el enlace para conectarte a tus clases virtuales, el cual lo puedes encontrar dentro de tu plataforma, CM Language Center.`,
        ),
      )
    }
    blocks.push(
      para(
        "Entra a tu panel para revisar el horario completo, los materiales del nivel y tu progreso.",
      ),
    )
    blocks.push(
      para(
        "Si necesitas reprogramar o tienes alguna duda, responde este correo y coordinación te ayuda.",
      ),
    )
  }

  return renderEmail({
    preheader:
      audience === "teacher"
        ? `Aula ${snapshot.classGroupName} — horario asignado`
        : `Tu nueva aula con ${teacherName}`,
    eyebrow: audience === "teacher" ? "ASIGNACIÓN" : "TU AULA",
    heading: audience === "teacher" ? "Aula asignada" : "Empezamos pronto",
    blocks,
    cta: { label: ctaLabel, url: ctaUrl },
    fineprint:
      audience === "teacher"
        ? "Este correo es informativo. Las clases concretas las verás en tu agenda."
        : "Este correo es informativo. Las clases concretas las verás en tu panel cuando estén programadas.",
  })
}

/**
 * Tabla "card" con el horario semanal. Cada fila tiene:
 *   - Día en serif italic con un punto teal de acento (mismo ADN visual que
 *     el wordmark del shell).
 *   - Rango horario en mono, tabular-nums, con un guion fino como separador.
 *   - Duración como meta-dato discreto.
 *
 * El header de la tarjeta usa una eyebrow uppercase en sans para diferenciar
 * el bloque del cuerpo editorial. Bordes 1px y bg blanco para encajar con el
 * card padre sin pelear con él.
 *
 * Renderizado en `<table>` por las mismas razones que el resto del shell:
 * Outlook usa Word engine y `<div>` con border/padding se rompe.
 */
function renderScheduleBlock(
  slots: { dayOfWeek: number; startTime: string; durationMinutes: number }[],
): string {
  if (slots.length === 0) {
    return `<p style="margin:0 0 20px 0;font-family:${EMAIL_FONTS.sans};font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textMuted};font-style:italic;">
      Horario por confirmar.
    </p>`
  }

  const rows = slots
    .map((s, i) => {
      const end = addMinutes(s.startTime, s.durationMinutes)
      const borderTop = i === 0 ? "" : `border-top:1px solid ${EMAIL_COLORS.border};`
      const durationLabel = formatDurationLabel(s.durationMinutes)
      return `<tr>
        <td style="padding:14px 20px;${borderTop}vertical-align:middle;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:12px;font-size:0;line-height:0;vertical-align:middle;">
                <span style="display:inline-block;width:6px;height:6px;background:${EMAIL_COLORS.teal};border-radius:50%;"></span>
              </td>
              <td style="vertical-align:middle;font-family:${EMAIL_FONTS.serif};font-style:italic;font-size:16px;line-height:1.2;color:${EMAIL_COLORS.ink};letter-spacing:-0.005em;">
                ${DAYS_ES_LONG[s.dayOfWeek]}
              </td>
            </tr>
          </table>
        </td>
        <td align="right" style="padding:14px 20px;${borderTop}vertical-align:middle;font-family:${EMAIL_FONTS.mono};font-size:13.5px;line-height:1.2;color:${EMAIL_COLORS.body};white-space:nowrap;">
          <span style="color:${EMAIL_COLORS.ink};font-weight:500;">${s.startTime}</span><span style="color:${EMAIL_COLORS.textFaded};padding:0 8px;">–</span><span style="color:${EMAIL_COLORS.ink};font-weight:500;">${end}</span>
          <span style="display:block;margin-top:3px;font-family:${EMAIL_FONTS.sans};font-size:11px;letter-spacing:0.04em;color:${EMAIL_COLORS.textFaded};">${durationLabel}</span>
        </td>
      </tr>`
    })
    .join("")

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 24px 0;border-collapse:separate;border-spacing:0;width:100%;background:${EMAIL_COLORS.white};border:1px solid ${EMAIL_COLORS.border};border-radius:12px;">
    <tr>
      <td colspan="2" style="padding:14px 20px 12px 20px;border-bottom:1px solid ${EMAIL_COLORS.border};background:${EMAIL_COLORS.bone};border-radius:12px 12px 0 0;font-family:${EMAIL_FONTS.sans};font-size:10.5px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${EMAIL_COLORS.textMuted};">
        Horario semanal · ${slots.length} ${slots.length === 1 ? "clase" : "clases"} por semana
      </td>
    </tr>
    ${rows}
  </table>`
}

function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes % 60 === 0) return `${minutes / 60} h`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h} h ${m} min`
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number]
  const total = h * 60 + m + minutes
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
