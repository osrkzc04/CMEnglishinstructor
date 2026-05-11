# Flujo 3 — Rendir examen (motor con expiración y snapshots)

> **El flujo más delicado del sistema.** Tiene temporizador en tiempo real,
> validación anti-trampa, y sortea contenido inmutable. Leer completo antes de
> tocar el módulo `src/modules/tests/`.

## Actores

- **Candidato** (anónimo, accede vía token)

## Pre-requisitos

- `InviteToken` válido, no expirado, no usado (o usado con sesión `IN_PROGRESS` existente).
- `TestTemplate` con preguntas disponibles según sus filtros.

---

## Principios del motor

### P1 — El reloj es del servidor

El frontend muestra un countdown cosmético, pero **toda validación de tiempo la hace el servidor** contra `TestSession.deadline`. Si el candidato manipula JS, no gana tiempo. Cada request valida `now() <= deadline + GRACE_MS`.

### P2 — Snapshot inmutable

Cuando se sortea la prueba, se **copian** los textos de preguntas y opciones a `TestSessionQuestion` como JSON. Desde ese momento, editar el banco de preguntas no afecta al intento.

### P3 — Resumibilidad automática

Si el candidato refresca, cierra el navegador y vuelve, o pierde internet por 2 minutos: **retoma donde estaba**. El servidor mantiene estado completo. El reloj sigue corriendo (no se pausa).

### P4 — Auto-envío sin cron crítico

Cualquier consulta a una sesión pasada el deadline → se marca `TIMED_OUT` y se califica. Hay un cron de respaldo cada 5 min para cubrir candidatos que nunca vuelven a consultar.

### P5 — Eventos sospechosos no bloquean

Pérdida de foco, intento de copy/paste, salir de fullscreen → se registran en `TestSessionEvent` pero no rompen el examen. La supervisión por videollamada es la defensa real.

---

## Estados de `TestSession`

```
         start                submit                  reviewed
  none ──────────► IN_PROGRESS ────────► SUBMITTED ──────────► REVIEWED
                       │
                       │ deadline exceeded
                       ▼
                    TIMED_OUT ──────────► REVIEWED
                       │
                       │ browser closed + cron detects
                       ▼
                    ABANDONED (if no answers)
```

---

## Paso a paso

### 1. Acceso al link

**Ruta**: `/prueba/[token]` (Server Component, sin auth)

Lógica server-side:

```typescript
const invite = await prisma.inviteToken.findUnique({
  where: { token: params.token },
  include: { template: true, session: true },
})

if (!invite) return notFound()
if (invite.expiresAt < new Date() && !invite.session) {
  return <ExpiredPage />
}
if (invite.session?.status === 'SUBMITTED' || invite.session?.status === 'REVIEWED') {
  return <AlreadySubmittedPage />
}
if (invite.session?.status === 'IN_PROGRESS') {
  // Retomar sesión existente
  redirect(`/prueba/${token}/rendir`)
}
// Sesión no iniciada aún: pantalla de bienvenida con botón "Comenzar"
return <WelcomePage invite={invite} />
```

### 2. Comenzar

**Endpoint**: `POST /api/test-sessions/start` con `{ token }`

En `src/modules/tests/sessions/start.ts`:

```typescript
export async function startTestSession(token: string) {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.inviteToken.findUnique({
      where: { token },
      include: { session: true, template: { include: { topicFilters: true } } },
    })

    if (!invite) throw new NotFoundError("Invitation")
    if (invite.expiresAt < new Date() && !invite.session) throw new ExpiredError()
    if (invite.session?.status === "IN_PROGRESS") return invite.session // resumir
    if (invite.session) throw new AlreadyUsedError()

    // Sortear preguntas según template
    const questions = await sampleQuestions(tx, invite.template)

    // Crear session con deadline
    const deadline = new Date(Date.now() + invite.template.timeLimitMinutes * 60_000)
    const session = await tx.testSession.create({
      data: {
        inviteId: invite.id,
        templateId: invite.templateId,
        candidateName: invite.candidateName,
        candidateEmail: invite.candidateEmail,
        deadline,
        status: "IN_PROGRESS",
      },
    })

    // Crear snapshot de cada pregunta
    await tx.testSessionQuestion.createMany({
      data: questions.map((q, idx) => ({
        sessionId: session.id,
        order: idx + 1,
        questionId: q.id,
        promptSnapshot: q.prompt,
        typeSnapshot: q.type,
        pointsSnapshot: q.points,
        optionsSnapshot:
          q.type === "MULTIPLE_CHOICE"
            ? q.options.map((o) => ({
                id: o.id,
                text: o.text,
                isCorrect: o.isCorrect,
                order: o.order,
              }))
            : null,
        acceptedAnswersSnapshot:
          q.type === "FILL_IN"
            ? q.fillAnswers.map((a) => ({
                answer: a.acceptedAnswer,
                caseSensitive: a.caseSensitive,
              }))
            : null,
      })),
    })

    // Marcar token usado
    await tx.inviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    })

    return session
  })
}
```

El `sampleQuestions` aplica filtros de `TestTemplateTopic` para garantizar que se sorteen N preguntas de cada tópico. Usa `ORDER BY random() LIMIT N` por grupo.

### 3. Rendir

**Ruta**: `/prueba/[token]/rendir` (Client Component)

La UI muestra:

- Pregunta actual (según `TestSessionQuestion.order`).
- Snapshot de opciones renderizadas (NO consulta `Question` vivo).
- Navegación: "Anterior" / "Siguiente" / "Ir a pregunta N".
- Timer mono en esquina: calcula localmente `deadline - now()`. Re-sincroniza con cada respuesta.
- Progress bar inferior.

Hooks del frontend para `TestSessionEvent`:

```typescript
useEffect(() => {
  const onBlur = () => postEvent("FOCUS_LOST")
  const onFocus = () => postEvent("FOCUS_REGAINED")
  const onCopy = (e) => {
    e.preventDefault()
    postEvent("COPY_ATTEMPT")
  }
  const onVisibility = () => {
    if (document.hidden) postEvent("FOCUS_LOST")
    else postEvent("FOCUS_REGAINED")
  }

  window.addEventListener("blur", onBlur)
  window.addEventListener("focus", onFocus)
  document.addEventListener("copy", onCopy)
  document.addEventListener("paste", onCopy)
  document.addEventListener("visibilitychange", onVisibility)

  return () => {
    /* cleanup */
  }
}, [])
```

### 4. Responder pregunta

**Endpoint**: `POST /api/test-sessions/[id]/answer`

Body: `{ questionOrder: number, selectedOptionId?: string, textAnswer?: string }`

En `src/modules/tests/sessions/answer.ts`:

```typescript
export async function answerQuestion(sessionId: string, input: AnswerInput) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.testSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new NotFoundError()
    if (session.status !== "IN_PROGRESS") throw new InvalidStateError()

    if (new Date() > addMilliseconds(session.deadline, GRACE_MS)) {
      await finalizeAsTimedOut(tx, sessionId)
      throw new TimedOutError()
    }

    await tx.testSessionQuestion.update({
      where: { sessionId_order: { sessionId, order: input.questionOrder } },
      data: {
        selectedOptionId: input.selectedOptionId,
        textAnswer: input.textAnswer,
        answeredAt: new Date(),
      },
    })

    return {
      savedAt: new Date(),
      remainingMs: Math.max(0, session.deadline.getTime() - Date.now()),
    }
  })
}
```

Frontend hace **auto-save con debounce** (500ms después del último cambio) o al navegar a otra pregunta.

### 5. Enviar

**Endpoint**: `POST /api/test-sessions/[id]/submit`

En `src/modules/tests/sessions/submit.ts`:

```typescript
export async function submitTestSession(sessionId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.testSession.findUnique({
      where: { id: sessionId },
      include: { questions: true },
    })
    if (!session) throw new NotFoundError()
    if (session.status !== "IN_PROGRESS") throw new InvalidStateError()

    const isTimedOut = new Date() > addMilliseconds(session.deadline, GRACE_MS)

    // Auto-calificar
    const { autoScore, maxAutoScore, gradedQuestions } = await autoGrade(session.questions)

    // Guardar resultados por pregunta
    for (const g of gradedQuestions) {
      await tx.testSessionQuestion.update({
        where: { id: g.id },
        data: { isCorrect: g.isCorrect, pointsAwarded: g.points },
      })
    }

    await tx.testSession.update({
      where: { id: sessionId },
      data: {
        autoScore,
        maxAutoScore,
        submittedAt: new Date(),
        status: isTimedOut ? "TIMED_OUT" : "SUBMITTED",
      },
    })

    return session
  })
}
```

`autoGrade` es una **función pura** en `src/modules/tests/grading/auto-grade.ts`. Recibe las preguntas con snapshots, devuelve puntajes. Fácil de testear sin mocks.

Después (fuera de transacción): `enqueueEmail('TEST_RESULT_READY', directoraEmail, ...)`.

### 6. Expiración (lazy + cron)

**Lazy**: cualquier endpoint que consulte una `TestSession` con `deadline < now()` y `status = IN_PROGRESS` ejecuta `finalizeAsTimedOut` antes de responder.

**Cron** (respaldo): `POST /api/cron/expire-test-sessions` (Vercel Cron cada 5 min):

```typescript
const stale = await prisma.testSession.findMany({
  where: {
    status: "IN_PROGRESS",
    deadline: { lt: new Date(Date.now() - 5 * 60_000) },
  },
})
for (const s of stale) await finalizeAsTimedOut(prisma, s.id)
```

---

## Funciones puras clave

### `sampleQuestions(tx, template)` → `Question[]`

En `src/modules/tests/sessions/sampling.ts`. Aplica filtros de tópico para garantizar composición. Usa `random()` de Postgres.

### `autoGrade(questions)` → `{ autoScore, maxAutoScore, gradedQuestions }`

En `src/modules/tests/grading/auto-grade.ts`. Función pura:

- Para `MULTIPLE_CHOICE`: compara `selectedOptionId` con la opción marcada `isCorrect` en el snapshot.
- Para `FILL_IN`: compara `textAnswer` contra `acceptedAnswersSnapshot` (case-sensitive o no según cada respuesta). Si no matchea ninguna, deja `isCorrect = null` (revisión manual).

## Tests críticos

- `auto-grade.test.ts`: casos multiple choice correctos/incorrectos, fill-in exacto, case-sensitive, múltiples respuestas aceptables, respuesta no incluida (null).
- `sampling.test.ts`: respeta `questionCount`, respeta `topicFilters`, no repite preguntas.
- `start.test.ts`: token expirado, token ya usado, retomar sesión en curso.
- `answer.test.ts`: respuesta después del deadline → marca TIMED_OUT.
- `submit.test.ts`: transacción atómica, cálculo correcto del score.
- **E2E Playwright**: rendir examen completo con timer acelerado, verificar submit, retomar después de refresh.

## Seguridad

- Token: 32 bytes hex = 256 bits de entropía.
- El endpoint `answer` verifica que el `sessionId` pertenece al token de la URL (previene sesión cruzada).
- CORS cerrado al dominio de la app.
- Rate limit en `/api/test-sessions/[id]/events` (1 evento por segundo máximo).
