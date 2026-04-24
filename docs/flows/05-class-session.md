# Flujo 5 — Dictado de clase: asistencia, bitácora y conteo de horas

## Actores

- **Docente** (toma asistencia, escribe bitácora)
- **Coordinador** (puede ver y editar dentro de la ventana permitida)
- **Estudiante** (consulta su histórico)

## Pre-requisitos

- `ClassSession` con `status=SCHEDULED` y al menos un `ClassParticipant`.
- AppSetting `absence_counts_as_consumed` (default `false`) y `log_edit_window_hours` (default 24).

## Estados de `ClassSession`

```
SCHEDULED ──► COMPLETED      (cierre normal)
SCHEDULED ──► CANCELLED      (cancelación con razón)
SCHEDULED ──► NO_SHOW        (nadie llegó, decisión del docente)
```

---

## Paso a paso

### 1. Vista del docente: "Mis clases de hoy"

**Ruta**: `/docente/clases` (guard: `requireRole(['TEACHER', 'DIRECTOR'])`)

Muestra sesiones asignadas al docente filtradas por fecha. Estados visuales:
- Próxima clase (>1h antes): card normal.
- En vivo (entre `scheduledStart` y `scheduledEnd + 30min`): card destacada con CTA "Iniciar clase".
- Sin cerrar (pasó el horario, todavía SCHEDULED): card en warning con CTA "Cerrar clase".
- Cerrada: card neutra con resumen.

### 2. Iniciar clase (opcional, marca timestamp)

`POST /api/class-sessions/[id]/start` → setea `actualStart = now()`. Solo el docente asignado puede ejecutarlo.

No es obligatorio pero ayuda al reporte.

### 3. Tomar asistencia

**Ruta**: `/docente/clases/[id]` 

La UI lista los `ClassParticipant`. Por cada uno:
- Nombre del estudiante.
- Select con `AttendanceStatus`: `PRESENT | ABSENT | LATE | EXCUSED`.
- Campo notas individual (opcional).

Se puede guardar parcialmente (auto-save) sin cerrar la clase.

`POST /api/class-sessions/[id]/attendance`:

```typescript
await prisma.$transaction(async (tx) => {
  for (const update of updates) {
    await tx.classParticipant.update({
      where: { id: update.participantId },
      data: {
        attendance: update.status,
        notes: update.notes,
      },
    })
  }
})
```

### 4. Escribir bitácora

Mismo formulario, sección "Bitácora":
- `topic`: título corto del tema cubierto (required).
- `activities`: descripción de actividades (required, textarea).
- `homework`: tareas asignadas (opcional).
- `materialsUsed`: materiales/páginas/links usados (opcional).

Se guarda como upsert en `ClassLog` (1:1 con sesión).

### 5. Cerrar la clase (acción crítica)

Esta es la operación que **actualiza contadores** y debe ser transaccional.

**Action** `close.action.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { getSetting } from '@/modules/settings'
import { differenceInMinutes } from 'date-fns'

export async function closeClassSession(sessionId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.classSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: { include: { enrollment: true } },
        teacher: true,
        log: true,
      },
    })
    
    if (!session) throw new NotFoundError()
    if (session.status === 'COMPLETED') throw new AlreadyClosedError()
    if (session.teacherId !== userId && !await isAdmin(userId)) throw new ForbiddenError()
    if (!session.log) throw new ValidationError('Bitácora requerida para cerrar')
    
    const absenceConsumes = await getSetting<boolean>('absence_counts_as_consumed')
    const actualEnd = session.actualEnd ?? new Date()
    const actualStart = session.actualStart ?? session.scheduledStart
    const realDurationMinutes = differenceInMinutes(actualEnd, actualStart)
    const scheduledDurationMinutes = differenceInMinutes(session.scheduledEnd, session.scheduledStart)
    const baseDurationMinutes = Math.min(realDurationMinutes, scheduledDurationMinutes)
    const baseHours = baseDurationMinutes / 60
    
    // Verificar que ningún participante esté en periodo de payroll cerrado (ADR-014)
    const lockedTeachers = await tx.payrollPeriod.findMany({
      where: {
        teacherId: session.teacherId,
        status: { in: ['CLOSED', 'PAID'] },
        startDate: { lte: session.scheduledStart },
        endDate:   { gte: session.scheduledStart },
      },
    })
    if (lockedTeachers.length > 0) throw new PayrollLockedError()
    
    // Snapshot de tarifa al cerrar (ADR-006)
    const rateSnapshot = session.teacher.hourlyRate
    
    // Actualizar cada participante
    for (const p of session.participants) {
      const counts = p.attendance === 'PRESENT' || p.attendance === 'LATE'
        || (p.attendance === 'ABSENT' && absenceConsumes)
      
      const hoursCounted = counts ? baseHours : 0
      
      await tx.classParticipant.update({
        where: { id: p.id },
        data: { hoursCounted, rateSnapshot },
      })
      
      // Actualizar contador denormalizado en Enrollment
      if (hoursCounted > 0) {
        await tx.enrollment.update({
          where: { id: p.enrollmentId },
          data: { consumedHours: { increment: hoursCounted } },
        })
      }
    }
    
    // Cerrar la sesión
    await tx.classSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', actualEnd },
    })
  })
}
```

### 6. Edición post-cierre (ventana limitada)

Dentro de `log_edit_window_hours` después del cierre, el docente puede editar la bitácora y la asistencia. Cualquier cambio en asistencia que afecte `hoursCounted` debe **revertir y re-aplicar** el delta en `Enrollment.consumedHours` en la misma transacción.

Después de la ventana, solo coordinador/director puede editar (con audit log).

### 7. Cancelación

`POST /api/class-sessions/[id]/cancel`:

```typescript
await prisma.classSession.update({
  where: { id: sessionId },
  data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
})

await enqueueEmail({ type: 'CLASS_CANCELLED', ... })
```

Cancelación NO consume horas, sin importar `absence_counts_as_consumed`.

---

## Validaciones críticas

### Bitácora obligatoria al cerrar

Sin `ClassLog`, no se cierra. Esto fuerza la disciplina de documentar cada clase.

### `consumedHours` siempre consistente

Todo cambio que afecte `ClassParticipant.hoursCounted` debe estar en transacción que también ajuste `Enrollment.consumedHours`. Nunca actualizar uno sin el otro.

### No exceder horas contratadas

Antes de incrementar `consumedHours`, validar:

```typescript
if (enrollment.consumedHours.add(hoursCounted) > enrollment.contractedHours + tolerance) {
  // Avisar al coordinador, requerir ExtraHours aprobadas
}
```

(Tolerancia de ~1h para evitar bloqueos por redondeo).

---

## Notificaciones

- **Recordatorio de clase**: cron por hora consulta sesiones próximas a `scheduledStart` dentro de `reminder_class_hours_before` y encola `CLASS_REMINDER` al docente y estudiantes.
- **Cancelación**: `CLASS_CANCELLED` a participantes.
- **Reprogramación**: `CLASS_RESCHEDULED` (si se mueve la fecha).

## Tests críticos

- `close.action.test.ts`:
  - Cierra correctamente con bitácora + asistencia.
  - Falla si no hay bitácora.
  - `consumedHours` se actualiza en Enrollment.
  - Ausente con `absence_counts_as_consumed=false` no consume.
  - Ausente con `absence_counts_as_consumed=true` sí consume.
  - Bloquea si la sesión cae en periodo de payroll cerrado.
  - `rateSnapshot` se setea correctamente.
- `edit-attendance.test.ts`: dentro de la ventana funciona; fuera requiere admin; revierte y re-aplica delta en Enrollment.
- E2E: docente cierra clase → coordinador ve hora consumida → reporte de matrícula refleja saldo correcto.
