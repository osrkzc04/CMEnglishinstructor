# Flujo 1 — Postulación y aprobación de docente

## Actores

- **Postulante** (anónimo, sin cuenta)
- **Coordinador** o **Director** (aprueba/rechaza)

## Pre-requisitos

- Niveles CEFR existentes en `CefrLevel`.
- AppSetting `default_price_per_hour` configurado.

## Diagrama de pasos

```
Postulante                   Sistema                      Coordinador
    |                           |                              |
    |---- llena form público -->|                              |
    |                           |-- valida + crea             |
    |                           |   TeacherApplication        |
    |                           |   (status: PENDING)         |
    |                           |-- encola email -->          |
    |                           |   TEACHER_APPLICATION        |
    |                           |   _RECEIVED                  |
    |<-- success page ----------|                              |
    |                           |-- notifica al coord. ------->|
    |                           |                              |
    |                           |<--- revisa en panel ---------|
    |                           |                              |
    |                           |<--- decide: aprobar o rechazar
    |                           |                              |
    |                           | [APROBAR]                    |
    |                           |   - crea User (TEACHER)      |
    |                           |   - crea TeacherProfile      |
    |                           |   - copia niveles aprobados  |
    |                           |   - copia disponibilidad     |
    |                           |   - envía email con link     |
    |                           |     de primer login          |
```

## Paso a paso

### 1. Postulante llena formulario público

**Ruta**: `/postular-docente` (sin auth)

**Campos**:
- Datos personales: `firstName`, `lastName`, `email`, `phone`, `document`.
- `bio` (texto libre).
- CV (archivo PDF/DOCX, opcional).
- Niveles CEFR en los que puede enseñar: multiselect sobre `CefrLevel` (mínimo 1).
- Disponibilidad semanal: componente de grilla día × hora (mismo componente que usará el estudiante y el docente contratado).

**Validación Zod** (en `src/modules/teachers/applications/schemas.ts`):
- `email` formato válido, único contra `User.email` Y `TeacherApplication.email` con status PENDING.
- `document` formato cédula/pasaporte ecuatoriano.
- Al menos 1 nivel.
- Al menos 1 slot de disponibilidad.

### 2. Submit: `submit.action.ts`

Server Action:

```typescript
await prisma.$transaction(async (tx) => {
  // Subir CV al storage si existe
  const cvKey = cv ? await storage.upload(`applications/${randomId}/cv.${ext}`, cv) : null
  
  const application = await tx.teacherApplication.create({
    data: { firstName, lastName, email, phone, document, bio, cvStorageKey: cvKey?.key },
  })
  
  await tx.teacherApplicationLevel.createMany({
    data: levelIds.map(levelId => ({ applicationId: application.id, levelId })),
  })
  
  await tx.applicationAvailability.createMany({
    data: slots.map(s => ({ applicationId: application.id, ...s })),
  })
  
  // Encolar emails (NO enviar dentro de la transacción)
  // Se hace después del commit con un callback o en un endpoint separado
})

// FUERA de la transacción:
await enqueueEmail({ type: 'TEACHER_APPLICATION_RECEIVED', to: email, ... })
await enqueueEmail({ type: 'TEACHER_APPLICATION_RECEIVED_ADMIN', to: coordinatorEmail, ... })
```

Redirige a `/postular-docente/success`.

### 3. Coordinador revisa

**Ruta**: `/admin/postulaciones` (guard: `requireRole(['COORDINATOR', 'DIRECTOR'])`)

Lista filtrable por status. Al abrir una postulación, ve:
- Datos completos del postulante.
- CV descargable (URL firmada del `StorageAdapter`).
- Niveles propuestos vs niveles que puede aprobar (subset editable).
- Disponibilidad propuesta (componente read-only, mismo grid).
- Campo `hourlyRate` prellenado con `default_price_per_hour` del AppSetting, editable.

### 4a. Aprobar: `approve.action.ts`

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Crear User (rol TEACHER)
  const tempPassword = generateTempPassword()
  const user = await tx.user.create({
    data: {
      email: app.email,
      passwordHash: await hash(tempPassword, 10),
      firstName: app.firstName,
      lastName: app.lastName,
      document: app.document,
      phone: app.phone,
      role: 'TEACHER',
    },
  })
  
  // 2. Crear TeacherProfile
  await tx.teacherProfile.create({
    data: {
      userId: user.id,
      hireDate: new Date(),
      hourlyRate: approvedRate,
      bio: app.bio,
      isActive: true,
    },
  })
  
  // 3. Copiar niveles APROBADOS (pueden ser subset de los propuestos)
  await tx.teacherLevel.createMany({
    data: approvedLevelIds.map(levelId => ({ teacherId: user.id, levelId })),
  })
  
  // 4. Copiar disponibilidad propuesta
  const proposed = await tx.applicationAvailability.findMany({ where: { applicationId: app.id } })
  await tx.teacherAvailability.createMany({
    data: proposed.map(s => ({ teacherId: user.id, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })),
  })
  
  // 5. Actualizar la application
  await tx.teacherApplication.update({
    where: { id: app.id },
    data: { status: 'APPROVED', reviewedBy: coordinatorId, reviewedAt: new Date(), userId: user.id },
  })
  
  return { user, tempPassword }
})

// FUERA de la transacción:
await enqueueEmail({
  type: 'TEACHER_APPLICATION_APPROVED',
  to: user.email,
  templateData: { firstName, tempPassword, loginUrl: `${APP_URL}/login` },
})
```

### 4b. Rechazar: `reject.action.ts`

```typescript
await prisma.teacherApplication.update({
  where: { id: app.id },
  data: { status: 'REJECTED', reviewedBy, reviewedAt: new Date(), rejectionReason },
})

await enqueueEmail({ type: 'TEACHER_APPLICATION_REJECTED', to: app.email, ... })
```

## Edge cases

- **Email duplicado**: bloquear en Zod con `.refine` async que consulte `User` y `TeacherApplication(PENDING)`.
- **Postulante quiere actualizar su postulación pendiente**: no permitir edición. Si quiere cambios, el coordinador puede rechazar pidiendo que vuelva a postular.
- **Aprobar sin niveles**: el guard en el formulario de aprobación exige al menos 1 nivel.
- **CV muy grande**: límite de 5MB validado en el `StorageAdapter.upload`.

## Tests a escribir

- `submit.action.test.ts`: happy path, email duplicado, sin niveles, disponibilidad vacía.
- `approve.action.test.ts`: happy path con niveles subset, transacción atómica (simular fallo y verificar rollback).
- `reject.action.test.ts`: happy path, verifica que no crea User.
- E2E Playwright: flujo completo postulación → aprobación → login del docente.
