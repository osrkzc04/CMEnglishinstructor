# Flujo 2 — Inscripción de estudiante con prueba de ubicación

## Actores

- **Coordinador** (crea invitación, matricula)
- **Candidato** (rinde prueba — es el futuro estudiante)
- **Directora** (revisa resultado y decide nivel)

## Pre-requisitos

- `TestTemplate` con `purpose=PLACEMENT` existente para el idioma.
- Banco de preguntas del nivel correspondiente.
- `AppSetting.invite_token_expiration_hours` configurado (default 24).

## Sub-flujos

Este flujo se compone de tres sub-flujos que pueden estar separados en el tiempo:

1. **Envío de invitación** (coordinador) → crea `InviteToken`.
2. **Candidato rinde prueba** (ver flujo 3 detallado).
3. **Revisión + matrícula** (directora + coordinador).

## Sub-flujo 1 — Envío de invitación

**Ruta**: `/admin/pruebas/invitaciones/nueva` (guard: coordinador/director)

**Formulario**:
- Datos del candidato: nombre, email, documento, teléfono.
- `TestTemplate` a usar (select filtrado por `purpose=PLACEMENT`).
- Notas internas (opcional).

**Server Action** `create.action.ts`:

```typescript
const token = crypto.randomBytes(32).toString('hex')
const expHours = await getSetting<number>('invite_token_expiration_hours')

await prisma.$transaction(async (tx) => {
  const invite = await tx.inviteToken.create({
    data: {
      token,
      templateId,
      candidateName, candidateEmail, candidateDocument, candidatePhone,
      notes,
      expiresAt: new Date(Date.now() + expHours * 3600_000),
      createdBy: session.user.id,
    },
  })
})

// Fuera de la transacción:
await enqueueEmail({
  type: 'TEST_INVITATION',
  to: candidateEmail,
  templateData: {
    candidateName,
    testUrl: `${APP_URL}/prueba/${token}`,
    expiresAt,
    instructionsFromTemplate,
  },
})
```

## Sub-flujo 2 — Candidato rinde prueba

Detallado en `03-test-session.md`. Resumen:

- Accede a `/prueba/{token}` sin auth.
- Sistema valida token, inicia sesión, sortea preguntas.
- Candidato responde dentro del tiempo límite.
- Al enviar (o al expirar), se marca `status=SUBMITTED` o `TIMED_OUT`.
- Se encola email `TEST_RESULT_READY` a la directora.

## Sub-flujo 3 — Revisión y matrícula

### 3.1 Directora revisa

**Ruta**: `/admin/pruebas/resultados/[id]` (guard: director)

Vista:
- Datos del candidato.
- Auto-score ya calculado para multiple choice.
- Lista de preguntas fill-in con respuesta del candidato + input para asignar puntos.
- Log de eventos sospechosos (`TestSessionEvent`) como línea de tiempo.
- Campo para asignar **nivel CEFR** recomendado (select de `CefrLevel`).
- Notas del revisor (texto libre).
- Botón "Marcar como revisada".

**Action** `manual-review.action.ts`:

```typescript
await prisma.$transaction(async (tx) => {
  // Aplicar puntajes manuales a preguntas fill-in
  for (const update of manualGrades) {
    await tx.testSessionQuestion.update({
      where: { id: update.questionId },
      data: {
        isCorrect: update.pointsAwarded > 0,
        pointsAwarded: update.pointsAwarded,
        reviewerComment: update.comment,
      },
    })
  }
  
  // Calcular finalScore
  const all = await tx.testSessionQuestion.findMany({ where: { sessionId } })
  const finalScore = all.reduce((sum, q) => sum + (q.pointsAwarded ?? 0), 0)
  
  await tx.testSession.update({
    where: { id: sessionId },
    data: {
      manualScore: manualPointsTotal,
      finalScore,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      reviewerNotes: notes,
      status: 'REVIEWED',
    },
  })
})

// Opcional: si AppSetting permite, enviar resultado al candidato
const canView = await getSetting<boolean>('candidate_can_view_results')
if (canView) {
  await enqueueEmail({ type: 'TEST_RESULT_STUDENT', to: candidateEmail, ... })
}
```

### 3.2 Coordinador matricula

**Ruta**: `/admin/inscripciones/nueva` (guard: coordinador/director)

Busca al candidato por email o documento → muestra pruebas revisadas.

Al seleccionar la prueba, abre formulario de matrícula **con campos pre-llenados**:
- Datos personales del candidato (desde `TestSession` y `InviteToken`).
- Idioma del curso (derivado del `TestTemplate.languageId`).
- **Curso** (`Course`): select filtrado por idioma.
- **Programa** (`Program`): select filtrado por el curso elegido.
- **Nivel del programa** (`ProgramLevel`): select filtrado por programa, con **sugerencia visual** del nivel cuyo `cefrLevelCode` coincide con el asignado por la directora.
- Modalidad: `VIRTUAL | PRESENCIAL | HIBRIDO`.
- Horario preferido del estudiante (grilla día × hora).
- Horas contratadas (default = `course.baseHours`, editable).
- Empresa/posición (opcional, para estudiantes corporativos).

**Action** `create.action.ts`:

```typescript
await prisma.$transaction(async (tx) => {
  const tempPassword = generateTempPassword()
  
  // 1. Crear User (rol STUDENT)
  const user = await tx.user.create({
    data: {
      email: candidateEmail,
      passwordHash: await hash(tempPassword, 10),
      firstName, lastName, document, phone,
      role: 'STUDENT',
    },
  })
  
  // 2. Crear StudentProfile
  await tx.studentProfile.create({
    data: { userId: user.id, company, position },
  })
  
  // 3. Horario preferido
  await tx.studentPreferredSchedule.createMany({
    data: preferredSlots.map(s => ({ studentId: user.id, ...s })),
  })
  
  // 4. Enrollment (con link a placementTest)
  const enrollment = await tx.enrollment.create({
    data: {
      studentId: user.id,
      programLevelId,
      modality,
      contractedHours,
      startDate: new Date(),
      status: 'ACTIVE',
      placementTestId: testSessionId,
    },
  })
  
  return { user, enrollment, tempPassword }
})

// Fuera:
await enqueueEmail({
  type: 'ENROLLMENT_CONFIRMATION',
  to: candidateEmail,
  templateData: { firstName, courseName, programLevelName, loginUrl, tempPassword },
})
```

## Edge cases

- **Candidato no rindió dentro de 24h**: token expira, coordinador debe crear uno nuevo.
- **Candidato rindió pero no fue matriculado**: la prueba queda como `REVIEWED`, el coordinador la puede usar semanas después. `placementTestId` se vincula al matricular.
- **Candidato ya es estudiante de otro curso**: no crear nuevo `User`. El coordinador busca el estudiante existente y agrega una nueva matrícula (flujo "Nueva matrícula para estudiante existente" — variante más simple).
- **Prueba con `status=ABANDONED`**: cron job marca así sesiones que superaron `deadline + margen` sin submit. La directora puede decidir ignorarlas o revisarlas.

## Notificaciones disparadas

- `TEST_INVITATION` → candidato (al crear el link).
- `TEST_RESULT_READY` → directora (al submit de la prueba).
- `TEST_RESULT_STUDENT` → candidato (solo si setting lo permite).
- `ENROLLMENT_CONFIRMATION` → nuevo estudiante (al crear matrícula).

## Tests críticos

- E2E completo: invitación → rendir → revisar → matricular.
- Verificar que `Enrollment.placementTestId` se vincula.
- Verificar que la temp password solo se muestra una vez y se hashea correctamente.
