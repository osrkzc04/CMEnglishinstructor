---
name: test-engine-rules
description: Use this skill whenever working on the test/exam engine (src/modules/tests/) in the CM English Instructor project. Covers server-authoritative timer, immutable question snapshots, automatic test resumption, lazy + cron expiration, anti-cheat event logging without blocking, sampling with topic filters, and auto-grading purity. Critical to read before any change to test sessions, invite tokens, or grading logic.
---

# Motor de exámenes — reglas estrictas

El motor de exámenes es el módulo más delicado del sistema. Maneja temporizadores en tiempo real, integridad de contenido inmutable, y validación anti-trampa. Estas reglas son **no negociables**.

## Las 5 reglas absolutas

### Regla 1 — El servidor es la única fuente de verdad del tiempo

`TestSession.deadline` se calcula al crear la sesión (`startedAt + timeLimitMinutes * 60_000`) y es la única autoridad. Toda validación temporal compara `now() <= deadline + GRACE_MS` server-side.

El frontend muestra un countdown visual, pero **es solo cosmético**. Si el cliente manipula JS y "agrega tiempo", el primer request al servidor lo descubre y marca la sesión como `TIMED_OUT`.

```typescript
const GRACE_MS = 30_000  // 30s de tolerancia para latencia de red

if (new Date() > addMilliseconds(session.deadline, GRACE_MS)) {
  await finalizeAsTimedOut(tx, sessionId)
  throw new TimedOutError()
}
```

### Regla 2 — Las preguntas son inmutables después del sorteo

Cuando se inicia una sesión:
1. Se sortean N preguntas según el `TestTemplate`.
2. Se copian a `TestSessionQuestion` con snapshot completo:
   - `promptSnapshot` (string)
   - `typeSnapshot` (enum)
   - `pointsSnapshot` (int)
   - `optionsSnapshot` (Json) — opciones completas con `isCorrect`
   - `acceptedAnswersSnapshot` (Json) — respuestas aceptables con `caseSensitive`
3. Desde ese momento, **el motor lee solo del snapshot**, nunca del banco vivo.

Si la directora edita o elimina una pregunta del banco después, los intentos en curso o pasados no se ven afectados. `TestSessionQuestion.questionId` es opcional; puede ser `null` si la pregunta original se eliminó.

### Regla 3 — La sesión es resumible automáticamente

Si el candidato:
- Refresca la página
- Cierra el navegador y vuelve
- Pierde internet por 2 minutos

Debe **retomar exactamente donde estaba**, con respuestas previas guardadas. El reloj sigue corriendo (no se pausa).

Implementación:
- Auto-save en cada respuesta (debounce 500ms o al cambiar de pregunta).
- Al re-entrar a `/prueba/[token]`, si existe `TestSession` con `status=IN_PROGRESS`, se redirige al endpoint de rendición que muestra las respuestas guardadas.

### Regla 4 — Expiración doble: lazy + cron

**Lazy** (principal): cualquier endpoint que toque una sesión con `deadline < now() && status=IN_PROGRESS` ejecuta `finalizeAsTimedOut` antes de responder.

**Cron** (respaldo cada 5 min): para sesiones de candidatos que cerraron el navegador y nunca volvieron, el cron las marca `TIMED_OUT`. Sin esto, quedarían en `IN_PROGRESS` indefinidamente.

```typescript
// Endpoint de cron
const stale = await prisma.testSession.findMany({
  where: {
    status: 'IN_PROGRESS',
    deadline: { lt: new Date(Date.now() - 5 * 60_000) },
  },
})

for (const s of stale) {
  await finalizeAsTimedOut(prisma, s.id)
}
```

### Regla 5 — Eventos sospechosos NO bloquean

`TestSessionEvent` registra `FOCUS_LOST`, `FOCUS_REGAINED`, `COPY_ATTEMPT`, `PASTE_ATTEMPT`, `FULLSCREEN_EXIT`, etc.

**No interrumpen el examen**. La defensa principal es la videollamada de supervisión. Estos eventos son defensa en profundidad — la directora los revisa al ver el resultado.

Razones para no bloquear:
- Falsos positivos (notificación del SO, alerta de calendario) generan frustración.
- Bloquear automáticamente requiere lógica de threshold subjetiva.
- La videollamada captura cualquier comportamiento sospechoso real.

## Estructura del módulo

```
src/modules/tests/
├── templates/
│   ├── schemas.ts
│   ├── queries.ts
│   ├── create.action.ts
│   └── update.action.ts
├── invites/
│   ├── schemas.ts
│   ├── create.action.ts
│   └── queries.ts
├── sessions/
│   ├── start.ts                ← inicia sesión, sortea, snapshot
│   ├── answer.ts               ← guarda respuesta, valida deadline
│   ├── submit.ts               ← cierra y auto-califica
│   ├── finalize-as-timed-out.ts
│   ├── sampling.ts             ← función pura: sortear preguntas
│   ├── log-event.ts            ← guarda TestSessionEvent
│   └── queries.ts
├── grading/
│   ├── auto-grade.ts           ← función pura, fácil de testear
│   ├── manual-review.action.ts
│   └── calculate-score.ts
└── __tests__/
    ├── auto-grade.test.ts      ← exhaustivo
    ├── sampling.test.ts
    ├── start.test.ts
    └── e2e/
        └── full-test-flow.spec.ts
```

## Funciones puras

`autoGrade` y `sampleQuestions` deben ser **funciones puras** (sin Prisma directo, reciben datos como argumentos):

```typescript
// grading/auto-grade.ts
export interface GradedQuestion {
  id: string
  isCorrect: boolean | null  // null si requiere revisión manual
  points: number
}

export interface GradeResult {
  autoScore: number
  maxAutoScore: number
  gradedQuestions: GradedQuestion[]
}

export function autoGrade(questions: TestSessionQuestion[]): GradeResult {
  // Lógica pura, sin Prisma
}
```

Esto permite tests unitarios exhaustivos sin DB:

```typescript
test('multiple choice correct answer', () => {
  const result = autoGrade([{
    id: 'q1',
    typeSnapshot: 'MULTIPLE_CHOICE',
    optionsSnapshot: [
      { id: 'a', text: 'A', isCorrect: true, order: 1 },
      { id: 'b', text: 'B', isCorrect: false, order: 2 },
    ],
    selectedOptionId: 'a',
    pointsSnapshot: 1,
    acceptedAnswersSnapshot: null,
    textAnswer: null,
  } as TestSessionQuestion])
  
  expect(result.gradedQuestions[0].isCorrect).toBe(true)
  expect(result.gradedQuestions[0].points).toBe(1)
})
```

## Sortear preguntas (sampling)

Respeta `TestTemplateTopic`: si el template define "5 preguntas de grammar + 5 de vocabulary", el sorteo debe garantizar exactamente esa composición.

```typescript
async function sampleQuestions(tx: Prisma.TransactionClient, template: TestTemplate & { topicFilters: TestTemplateTopic[] }) {
  if (template.topicFilters.length === 0) {
    // Sortear N totales sin filtro de tópico
    return tx.$queryRaw<Question[]>`
      SELECT * FROM "Question"
      WHERE "levelId" = ${template.levelId} AND "isActive" = true
      ORDER BY random()
      LIMIT ${template.questionCount}
    `
  }
  
  // Sortear por tópico
  const all: Question[] = []
  for (const filter of template.topicFilters) {
    const sample = await tx.$queryRaw<Question[]>`
      SELECT * FROM "Question"
      WHERE "levelId" = ${template.levelId} AND "topic" = ${filter.topic} AND "isActive" = true
      ORDER BY random()
      LIMIT ${filter.count}
    `
    all.push(...sample)
  }
  return all
}
```

Si no hay suficientes preguntas en un tópico, **fallar explícitamente** (no completar con otros tópicos sin avisar). El coordinador debe saber que el banco está incompleto.

## Endpoints del motor

Estos viven en `src/app/api/test-sessions/` (Route Handlers, no Server Actions, porque el frontend los consume frecuentemente):

- `POST /start` — body: `{ token }` → inicia o retoma.
- `POST /[id]/answer` — body: `{ questionOrder, selectedOptionId?, textAnswer? }` → guarda + valida deadline.
- `POST /[id]/submit` — cierra y califica.
- `POST /[id]/events` — body: `{ type, metadata? }` → registra evento sospechoso (rate-limited).
- `GET /[id]` — estado actual + tiempo restante.

Validar en TODOS:
- El `token` (o `sessionId`) corresponde a una sesión válida.
- La sesión no está en estado terminal (`SUBMITTED`, `REVIEWED`, `TIMED_OUT`, `ABANDONED`).
- Sin auth (la URL con token ES la auth).

## Anti-patrones específicos del motor

- ❌ Confiar en el tiempo del cliente para decidir si todavía puede responder.
- ❌ Leer `Question` original al renderizar — usar `TestSessionQuestion.promptSnapshot`.
- ❌ Bloquear el examen ante un evento sospechoso (rompe la regla 5).
- ❌ Pausar el reloj cuando se pierde foco (no es defensible y abre vector de trampa).
- ❌ Permitir que un cron mate una sesión que el usuario tiene abierta (siempre verificar `now() > deadline + GRACE_MS`).
- ❌ Generar IDs de respuesta en frontend (todo viene del snapshot del backend).
- ❌ Auto-grade mezclado con Prisma — debe ser función pura testeable.
- ❌ `sampleQuestions` que falla silenciosamente si faltan preguntas — debe lanzar error explícito.
