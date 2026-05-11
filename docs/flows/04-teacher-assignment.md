# Flujo 4 — Cruce de disponibilidad y asignación de docente

## Actores

- **Coordinador** (asigna docente a matrícula y genera sesiones)
- **Docente** (ve sus clases asignadas)
- **Estudiante** (ve sus clases asignadas)

## Pre-requisitos

- `Enrollment` activa con `StudentPreferredSchedule` definida.
- Al menos un `TeacherProfile` activo con `TeacherAvailability` y nivel CEFR compatible (si aplica).

## Objetivo

Encontrar docentes disponibles que (a) puedan enseñar el `ProgramLevel` de la matrícula, y (b) tengan slots de disponibilidad que coincidan con el horario preferido del estudiante. Generar las `ClassSession` recurrentes para el período del curso.

---

## Paso a paso

### 1. Coordinador abre la matrícula sin docente

**Ruta**: `/admin/inscripciones/[id]/asignar-docente` (guard: coordinador/director)

Vista:

- Datos de la matrícula (estudiante, programa, nivel, modalidad, horas).
- `StudentPreferredSchedule` renderizada en grilla día × hora (read-only).
- Lista de docentes candidatos rankeados.

### 2. Algoritmo de cruce y ranking

En `src/modules/scheduling/match.ts` (función pura, fácil de testear):

```typescript
type SlotMatch = {
  dayOfWeek: number
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
  durationMinutes: number
}

type TeacherCandidate = {
  teacher: TeacherProfile & { user: User }
  matchingSlots: SlotMatch[]
  totalMatchingMinutes: number
  recentClassesWithStudent: number // para penalizar repetición consecutiva (rotación mensual)
  score: number
}

export function rankCandidates(
  enrollment: Enrollment,
  preferred: StudentPreferredSchedule[],
  teachers: Array<
    TeacherProfile & {
      availability: TeacherAvailability[]
      teachableLevels: TeacherLevel[]
      user: User
    }
  >,
  recentAssignmentMap: Map<string, number>, // teacherId -> count
  classDuration: number,
): TeacherCandidate[] {
  return teachers
    .filter((t) => isLevelCompatible(t.teachableLevels, enrollment))
    .map((t) => {
      const matchingSlots = intersectSchedules(preferred, t.availability, classDuration)
      const totalMins = matchingSlots.reduce((sum, s) => sum + s.durationMinutes, 0)
      const recent = recentAssignmentMap.get(t.userId) ?? 0

      const score =
        totalMins * 1 - // peso alto: cuánto coinciden
        recent * 30 + // penalizar repetición reciente
        (t.user.role === "DIRECTOR" ? -10 : 0) // priorizar docentes regulares

      return {
        teacher: t,
        matchingSlots,
        totalMatchingMinutes: totalMins,
        recentClassesWithStudent: recent,
        score,
      }
    })
    .filter((c) => c.matchingSlots.length > 0)
    .sort((a, b) => b.score - a.score)
}
```

`intersectSchedules` opera en un eje de minutos (0-1439) por día de semana. Para cada par (slot del estudiante, slot del docente) intersecta y devuelve la ventana coincidente, descartando ventanas más cortas que `classDuration`.

### 3. Coordinador elige docente y horarios

La UI muestra los top 5 candidatos. Al seleccionar uno, se ven sus `matchingSlots`. El coordinador elige cuáles slots se usarán como horario semanal (ej: 2 clases por semana lunes 19:00 y miércoles 19:00).

También define:

- Fecha de inicio (default `enrollment.startDate`).
- Cantidad de sesiones a generar (calculada: `contractedHours * 60 / classDuration` redondeada).
- Modalidad heredada de `enrollment.modality` (editable).
- URL de la videollamada (si modalidad = VIRTUAL).

### 4. Generar sesiones

**Action** `generate-sessions.action.ts`:

```typescript
await prisma.$transaction(async (tx) => {
  const sessionsToCreate: Array<{ scheduledStart: Date; scheduledEnd: Date }> = []

  // Generar fechas según slots seleccionados
  let currentDate = startDate
  let sessionsLeft = totalSessions

  while (sessionsLeft > 0) {
    for (const slot of selectedSlots) {
      const slotDate = nextOccurrence(currentDate, slot.dayOfWeek)

      // Verificar que no haya conflicto con TeacherUnavailability
      const conflict = await hasUnavailability(tx, teacherId, slotDate)
      if (conflict) continue // saltar esta ocurrencia

      // Verificar que no haya conflicto con feriados (informativo, no bloqueante)
      const isHoliday = await isHolidayOn(tx, slotDate)

      sessionsToCreate.push({
        scheduledStart: combineLocalDateTime(slotDate, slot.startTime, "America/Guayaquil"),
        scheduledEnd: combineLocalDateTime(slotDate, slot.endTime, "America/Guayaquil"),
      })
      sessionsLeft--
      if (sessionsLeft === 0) break
    }
    currentDate = addWeeks(currentDate, 1)
  }

  // Crear sesiones + participants en bulk
  for (const s of sessionsToCreate) {
    await tx.classSession.create({
      data: {
        teacherId,
        scheduledStart: s.scheduledStart,
        scheduledEnd: s.scheduledEnd,
        modality,
        meetingUrl: modality === "VIRTUAL" ? meetingUrl : null,
        location: modality !== "VIRTUAL" ? location : null,
        status: "SCHEDULED",
        participants: {
          create: { enrollmentId: enrollment.id, attendance: "PENDING" },
        },
      },
    })
  }
})
```

Helpers:

- `combineLocalDateTime(date, "19:00", "America/Guayaquil")` → `Date` UTC. Usar `date-fns-tz`.
- `nextOccurrence(from, dayOfWeek)` → primera fecha >= from cuyo `getDay()` sea `dayOfWeek`.
- `hasUnavailability(tx, teacherId, date)` → consulta `TeacherUnavailability` por rango.

### 5. Notificaciones

Después del commit, encolar:

- `WEEKLY_SCHEDULE_TEACHER` al docente (próxima semana).
- `WEEKLY_SCHEDULE_STUDENT` al estudiante.

(Las notificaciones masivas semanales las envía un cron, no este flujo. Aquí solo se notifica al asignar inicialmente).

---

## Casos especiales

### Reasignación de docente

Cuando rota mensualmente:

1. Coordinador abre la matrícula → "Cambiar docente".
2. Sistema sugiere candidatos excluyendo al docente saliente.
3. Sesiones futuras (`scheduledStart > now()`) se actualizan: `teacherId` reasignado.
4. Bitácoras pasadas no se tocan (siguen vinculadas a la sesión, no al docente).
5. Notificar al estudiante y a ambos docentes.

### Sesiones grupales (empresa)

Al asignar un docente a una matrícula corporativa, el coordinador puede vincular **múltiples matrículas** a las mismas sesiones (todos los empleados de la misma empresa que toman el mismo curso). En la UI: agregar `enrollmentIds: string[]` al formulario.

### Conflicto: estudiante tiene otra clase en ese horario

Antes de generar, validar contra `ClassParticipant` existentes del estudiante. Si hay solapamiento, advertir al coordinador con detalle del conflicto.

### Conflicto: docente tiene otra clase en ese horario

Validar contra `ClassSession` del mismo `teacherId` que se solapen.

---

## Tests críticos

- `intersectSchedules.test.ts`: caso sin coincidencia, coincidencia parcial, coincidencia total, ventana más corta que classDuration.
- `rankCandidates.test.ts`: empate por matching, desempate por menor `recentAssignmentCount`, exclusión por nivel incompatible.
- `generate-sessions.test.ts`: salto de feriados (informativo), salto de TeacherUnavailability (bloqueante), generación correcta del número de sesiones.
- E2E: matricular → asignar docente → ver calendario del docente con las clases creadas.
