---
name: email-notifications
description: Use this skill whenever sending emails or working with the EmailNotification queue in the CM English Instructor project. Covers the queue-first pattern (never send inside transactions), the EmailProvider abstraction (console/Resend), template structure with react-email, retry logic with backoff, scheduling with scheduledFor, and the demo mode override. Read before adding any email-sending code.
---

# Email notifications — patrones obligatorios

Toda comunicación por correo del sistema sigue **el patrón de cola**: insertar en DB primero, enviar después. Nunca enviar directamente desde la lógica de negocio.

## Por qué cola y no envío directo

1. **Resiliencia**: si Resend está caído, no rompe la operación de negocio (matrícula, asignación, cierre de clase).
2. **Auditoría**: histórico completo de qué se envió, a quién, cuándo, con qué contenido.
3. **Reintentos**: failure transitorio se reintenta con backoff sin intervención manual.
4. **Demo mode**: poder desactivar envío real sin tocar código (`DEMO_MODE=true`).
5. **Programación**: `scheduledFor` permite envíos diferidos (cronograma semanal, recordatorios).

## El patrón

### 1. Encolar (en la lógica de negocio)

```typescript
import { enqueueEmail } from '@/modules/notifications'

await prisma.$transaction(async (tx) => {
  const enrollment = await tx.enrollment.create({ ... })
  // ... más operaciones de la transacción
})

// FUERA de la transacción
await enqueueEmail({
  type: 'ENROLLMENT_CONFIRMATION',
  to: studentEmail,
  templateData: {
    firstName: 'Juan',
    courseName: 'Time Zones 2',
    loginUrl: `${APP_URL}/login`,
    tempPassword,
  },
  // Contexto opcional para auditoría
  userId: newStudentUser.id,
})
```

`enqueueEmail` solo crea el registro en `EmailNotification` con `status=QUEUED`. **No envía nada**.

### 2. El cron procesa la cola

`POST /api/cron/process-emails` (Vercel Cron cada minuto):

```typescript
import { getEmailProvider } from '@/lib/email'

const provider = getEmailProvider()

const queued = await prisma.emailNotification.findMany({
  where: {
    status: 'QUEUED',
    OR: [
      { scheduledFor: null },
      { scheduledFor: { lte: new Date() } },
    ],
    attempts: { lt: 3 },
  },
  take: 50,
  orderBy: { createdAt: 'asc' },
})

for (const notif of queued) {
  try {
    const { subject, html } = await renderTemplate(notif.type, notif.templateData)
    await provider.send({
      to: notif.to,
      cc: notif.cc,
      subject,
      html,
    })
    await prisma.emailNotification.update({
      where: { id: notif.id },
      data: { status: 'SENT', sentAt: new Date(), subject },
    })
  } catch (error) {
    const attempts = notif.attempts + 1
    await prisma.emailNotification.update({
      where: { id: notif.id },
      data: {
        attempts,
        status: attempts >= 3 ? 'FAILED' : 'QUEUED',
        error: String(error),
      },
    })
  }
}
```

## EmailProvider: interfaz abstracta

`src/lib/email/provider.ts`:

```typescript
export interface EmailProvider {
  send(input: { to: string; cc?: string; subject: string; html: string; from?: string }): Promise<void>
}
```

Implementaciones:
- `ConsoleProvider` (dev) — solo `console.log` del email completo.
- `ResendProvider` (prod) — usa SDK de Resend.

Selección por `EMAIL_PROVIDER` env var. Si `DEMO_MODE=true`, **siempre** se usa Console sin importar el setting.

```typescript
// src/lib/email/index.ts
export function getEmailProvider(): EmailProvider {
  if (process.env.DEMO_MODE === 'true') return new ConsoleProvider()
  if (process.env.EMAIL_PROVIDER === 'resend') return new ResendProvider()
  return new ConsoleProvider()
}
```

## Templates con react-email

Cada tipo de email es un componente React en `emails/`:

```
emails/
├── _components/
│   ├── EmailLayout.tsx        ← layout con header (logo) y footer
│   └── Button.tsx
├── enrollment-confirmation.tsx
├── test-invitation.tsx
├── test-result-ready.tsx
├── teacher-application-approved.tsx
├── class-reminder.tsx
└── ...
```

Cada template recibe `templateData` tipado:

```typescript
// emails/enrollment-confirmation.tsx
import { Body, Container, Heading, Text } from '@react-email/components'
import { EmailLayout } from './_components/EmailLayout'
import { Button } from './_components/Button'

export interface EnrollmentConfirmationData {
  firstName: string
  courseName: string
  loginUrl: string
  tempPassword: string
}

export default function EnrollmentConfirmation({ firstName, courseName, loginUrl, tempPassword }: EnrollmentConfirmationData) {
  return (
    <EmailLayout previewText={`Bienvenido, ${firstName}`}>
      <Heading>Bienvenido, {firstName}</Heading>
      <Text>Tu matrícula en <strong>{courseName}</strong> ha sido confirmada.</Text>
      <Text>Tu contraseña temporal es: <code>{tempPassword}</code></Text>
      <Button href={loginUrl}>Iniciar sesión</Button>
    </EmailLayout>
  )
}

EnrollmentConfirmation.subject = (data: EnrollmentConfirmationData) =>
  `Bienvenido a CM English Instructor — ${data.courseName}`
```

`renderTemplate(type, data)` mapea `EmailType` enum al componente y renderiza con `@react-email/render`.

### Estilo de los templates

Aplican los mismos principios de marca (`design-brief.md`):
- Fondo bone, texto ink.
- Logo monograma en header.
- Tipografía Fraunces para titulares, sans para cuerpo.
- Botón único en teal.
- Footer con datos de contacto: `cmonsalve@cmenglishinstructor.com`, `+593 958 74 70 16`.

## Tipos de email del sistema

Definidos en `EmailType` enum del schema. Cuando agregues uno nuevo:

1. Agregar valor al enum en `prisma/schema.prisma` y migrar.
2. Crear el componente en `emails/<kebab-case-name>.tsx`.
3. Registrarlo en `renderTemplate` map.
4. Definir `templateData` interface y exportarla.
5. Documentar en este archivo cuándo se dispara.

## Cuándo dispararlas

| Tipo | Disparo |
|---|---|
| `TEACHER_APPLICATION_RECEIVED` | postulante completa el form (al postulante + admin) |
| `TEACHER_APPLICATION_APPROVED` | coordinador aprueba postulación |
| `TEACHER_APPLICATION_REJECTED` | coordinador rechaza postulación |
| `TEST_INVITATION` | coordinador genera link de prueba |
| `TEST_RESULT_READY` | candidato envía la prueba (a la directora) |
| `TEST_RESULT_STUDENT` | si AppSetting lo permite, al candidato |
| `ENROLLMENT_CONFIRMATION` | coordinador crea matrícula |
| `CLASS_REMINDER` | cron horario, X horas antes de la clase |
| `CLASS_CANCELLED` | docente o coordinador cancela una sesión |
| `CLASS_RESCHEDULED` | se mueve fecha/hora de una sesión |
| `WEEKLY_SCHEDULE_TEACHER` | cron semanal (domingo 18:00) |
| `WEEKLY_SCHEDULE_STUDENT` | cron semanal (domingo 18:00) |
| `MONTHLY_SCHEDULE_TEACHER` | cron mensual |
| `MONTHLY_SCHEDULE_STUDENT` | cron mensual |
| `PAYROLL_CLOSED` | director cierra periodo de payroll |
| `PASSWORD_RESET` | usuario solicita reset |

## Anti-patrones

- ❌ `await resend.send(...)` directo en una Server Action — usar `enqueueEmail`.
- ❌ Llamar a `resend.send` dentro de `prisma.$transaction` — bloqueante y rompe el rollback.
- ❌ Generar el HTML en string concatenado — usar componentes react-email.
- ❌ Hardcodear "from" en cada llamada — usar env var `EMAIL_FROM`.
- ❌ Loop infinito de reintentos — máximo 3 attempts, luego `FAILED`.
- ❌ Enviar emails desde tests E2E sin mockear el provider — usar `DEMO_MODE=true` en CI.
- ❌ Olvidar incluir `previewText` en el layout (lo que se ve en la bandeja antes de abrir).
