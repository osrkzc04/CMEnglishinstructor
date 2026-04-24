---
name: language-school-domain
description: Use this skill whenever working on features for the CM English Instructor language school platform. Covers domain vocabulary (course vs program vs program level vs CEFR level), enrollment lifecycle, group classes modeling without a Group entity, teacher rotation rules, hours accounting (consumed vs contracted, who decides if absences consume), modality semantics, and the rationale behind one-user-one-role. Read before implementing any feature touching enrollments, classes, teachers, or students.
---

# Dominio: academia CM English Instructor

Vocabulario, reglas y sutilezas del dominio que no son obvias de leer el schema. Si trabajas sobre matrículas, clases, docentes o estudiantes, lee esto.

## Vocabulario crítico (no confundir)

### Catálogo: 3 niveles distintos

```
Language     →  English, Español
Course       →  General English, Business English, Kids Learning, Español
Program      →  Time Zones, Life, Market Leader, Specialization, Vistas
ProgramLevel →  Time Zones 1, Market Leader Elementary, Presenting (módulo)
```

- **Course** ≠ "una clase". Course = "tipo de programa" (categoría).
- **Program** = libro/plataforma específica. Tiene `publisher`, `platformUrl`, y `structureType`.
- **ProgramLevel** = nivel concreto que se matricula. **Esto es lo que aparece en la matrícula**, no Course ni Program.

### CEFR vs ProgramLevel

`CefrLevel` (A1, A2, B1, ...) **solo lo usa el motor de pruebas de ubicación**. NO es lo que se matricula. Sirve para que el coordinador interprete el resultado de la prueba (por ej, "B1") y matricule en el ProgramLevel apropiado (por ej, "Time Zones 3", que tiene `cefrLevelCode = "B1"` como referencia informativa).

No confundas:
- "El estudiante tomó nivel A2 en la prueba" → CefrLevel
- "El estudiante está matriculado en Time Zones 2" → ProgramLevel

### Matrícula vs sesión

- **Enrollment** (matrícula): vínculo persistente entre estudiante y ProgramLevel. Tiene contracted/consumed hours, modalidad.
- **ClassSession** (sesión): clase individual de 45 min. Una matrícula tiene N sesiones.
- **ClassParticipant**: pivote. Un estudiante en una sesión específica, con su asistencia y horas contadas individuales.

### Bitácora (ClassLog)

Vive en la **sesión**, no en la matrícula. Razón: rotación mensual de docentes (ver más abajo).

## Reglas de negocio importantes

### Un usuario = un rol

Decisión explícita del cliente (ADR-002). La directora es `DIRECTOR` con permisos que incluyen dictar (puede tener `TeacherProfile`). NO se modela como doble rol. Si necesitas filtrar docentes "que también dicta el director":

```typescript
where: {
  role: { in: ['TEACHER', 'DIRECTOR'] },
  teacherProfile: { isActive: true },
}
```

### Clases grupales sin entidad `Group`

Cuando una empresa matricula 5 empleados al mismo curso:
1. Cada empleado tiene su propia `Enrollment`.
2. Las sesiones se crean con N `ClassParticipant` (uno por matrícula).
3. La bitácora es una sola por sesión (ven el mismo tema).
4. La asistencia y `hoursCounted` son **individuales** por participante.

NO crear entidad Group. Si un empleado se retira, su matrícula se cancela sin afectar a los demás.

### Rotación mensual de docentes

La directora rota docentes mensualmente para que el estudiante reciba diversidad de acentos y estilos. Implicaciones:

- La bitácora debe vivir en la **sesión**, no en el docente, para que el siguiente docente vea todo el histórico del estudiante.
- El algoritmo de asignación (flujo 04) **penaliza repetición consecutiva** de docente con el mismo estudiante.
- Reasignar docente a una matrícula activa solo cambia `teacherId` en sesiones futuras (`scheduledStart > now()`). Las pasadas mantienen su docente.

### Horas: contracted vs consumed

- `Enrollment.contractedHours` = `Course.baseHours` + `ExtraHours` aprobadas.
- `Enrollment.consumedHours` = denormalizado, suma de `ClassParticipant.hoursCounted` cerrados.
- Saldo = `contractedHours - consumedHours`.

**Toda actualización de `hoursCounted` en `ClassParticipant` debe ajustar `consumedHours` en `Enrollment` en la misma transacción.** Esto es no-negociable.

### Política de ausencia (configurable)

`AppSetting.absence_counts_as_consumed`:
- `false` (default): estudiante ausente NO consume horas.
- `true`: ausencia sí consume.

La lógica al cerrar la sesión consulta este setting y lo aplica:

```typescript
const absenceConsumes = await getSetting<boolean>('absence_counts_as_consumed')
const counts = (attendance === 'PRESENT' || attendance === 'LATE')
            || (attendance === 'ABSENT' && absenceConsumes)
```

`EXCUSED` y `CANCELLED` nunca consumen horas, sin importar el setting.

### Modalidad por matrícula, no por programa

El mismo "Time Zones 2" puede dictarse virtual a un estudiante y presencial a otro. La modalidad vive en `Enrollment.modality`, no en `Program`. Cada `ClassSession` también tiene modalidad propia (puede variar entre sesiones de la misma matrícula si justifica).

### Tarifa snapshot al cerrar

Al cerrar `ClassSession`, copiar `TeacherProfile.hourlyRate` a cada `ClassParticipant.rateSnapshot`. La facturación usa el snapshot, nunca la tarifa actual. Esto permite cambiar la tarifa del docente prospectivamente sin afectar histórico.

### Storage de credenciales externas — NO

El sistema no guarda credenciales de NG Learning, Pearson, ni ninguna plataforma externa. El estudiante recibe un email de la editorial (gestionado fuera del sistema) y accede directo. El sistema solo guarda `Program.platformUrl` como link informativo.

## Estados y transiciones

### Enrollment

```
ACTIVE ──► PAUSED ──► ACTIVE
   │           │
   ├──► COMPLETED  (consumió todas las horas)
   └──► CANCELLED  (decisión del coordinador, no consume más)
```

PAUSED es para casos como "el estudiante viajó 1 mes". No se generan nuevas sesiones pero la matrícula no se cancela.

### ClassSession

```
SCHEDULED ──► COMPLETED   (cerrada con bitácora)
SCHEDULED ──► CANCELLED   (con razón)
SCHEDULED ──► NO_SHOW     (nadie llegó)
```

Una sesión `CANCELLED` o `NO_SHOW` **no puede cerrarse** después. Para "recuperar" una clase, se programa una nueva sesión.

### TestSession

```
IN_PROGRESS ──► SUBMITTED  ──► REVIEWED
       │
       ├──► TIMED_OUT ──► REVIEWED
       └──► ABANDONED      (cron detecta inactividad larga sin respuestas)
```

## Patrones recurrentes

### Validar saldo antes de programar más sesiones

```typescript
const usedSoFar = enrollment.consumedHours
const totalNeeded = sessionsToCreate.length * (classDuration / 60)
if (usedSoFar.add(totalNeeded).gt(enrollment.contractedHours)) {
  // Bloquear o requerir ExtraHours aprobadas
}
```

### Cruce de disponibilidad

`TeacherAvailability` y `StudentPreferredSchedule` son patrones semanales (`dayOfWeek` + `HH:mm`). Para encontrar coincidencias, intersectar como minutos del día (0-1439) por día de semana, descartando ventanas más cortas que la duración de clase.

### Snapshot de pregunta

Al sortear preguntas para una `TestSession`, copiar `prompt`, `options` (Json) y `acceptedAnswers` (Json) a `TestSessionQuestion`. Desde ese momento, editar el banco no afecta el intento. La FK `questionId` queda como referencia opcional.

## Anti-patrones específicos del dominio

- ❌ Crear "modelo de Class" separado de ClassSession (es lo mismo, no duplicar).
- ❌ Borrar `Question` con `delete` cuando se quiere "desactivar" — usar `isActive=false`.
- ❌ Calcular facturación con `TeacherProfile.hourlyRate` actual — usar `rateSnapshot`.
- ❌ Permitir editar `hoursCounted` cuando el periodo de payroll está `CLOSED`.
- ❌ Asumir que `ProgramLevel.code` es numérico — es `String` libre ("1", "Elementary", "Presenting").
- ❌ Confundir CEFR con ProgramLevel en queries de matrícula.
- ❌ Generar sesiones de clase sin validar `TeacherUnavailability`.
- ❌ Modelar cancelación de clase como soft-delete del registro — es transición de status.
