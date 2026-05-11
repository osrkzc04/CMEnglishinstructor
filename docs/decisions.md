# Architecture Decision Records (ADR)

> Registro cronológico de las decisiones importantes del proyecto. Cuando haya
> que cambiar algo, se agrega una nueva ADR (no se edita la anterior). Si una
> decisión antigua se revoca, se escribe una nueva ADR que la supersede.

---

## ADR-001 — Stack: Next.js full-stack con React

**Fecha**: 2026-04  
**Estado**: Aceptado  
**Contexto**: La propuesta inicial era Next.js API + Vue frontend. Esto duplica configuración de auth, tipos compartidos, deploy, y pierde las ventajas de Next.

**Decisión**: Next.js 15 App Router como framework único, React 19 como lenguaje de UI.

**Consecuencias**:
- Un solo repo, un solo deploy, tipos compartidos entre servidor y cliente.
- Server Actions como mecanismo principal, Route Handlers solo para webhooks/cron/endpoints del examen.
- Menor curva si en el futuro hay que abrir una API pública (se agregarán handlers sin rewrite).

---

## ADR-002 — Un usuario, un rol

**Fecha**: 2026-04  
**Estado**: Aceptado  
**Contexto**: Se evaluó rol M:N (un usuario puede ser Director y Docente simultáneamente). La directora dicta clases además de administrar.

**Decisión**: Rol único por usuario. La directora se modela como `DIRECTOR`, cuyos permisos incluyen dictar clases (puede tener `TeacherProfile` opcional).

**Consecuencias**:
- Queries de autorización son triviales (un solo campo enum).
- Cualquier docente que también quiera administrar requerirá crear dos cuentas distintas.
- La UI de asignación de docentes filtra por `role IN (TEACHER, DIRECTOR) AND teacherProfile.isActive = true`.

---

## ADR-003 — Clases grupales sin entidad `Group`

**Fecha**: 2026-04  
**Estado**: Aceptado  
**Contexto**: Empresas matriculan a varios empleados para tomar el mismo curso. Se evaluó crear una entidad `Group` que agrupe matrículas.

**Decisión**: No crear `Group`. Las clases grupales se modelan como `ClassSession` con N `ClassParticipant`, donde cada participante apunta a una `Enrollment` individual.

**Consecuencias**:
- Cada estudiante del grupo tiene su propia matrícula con sus horas, su asistencia, su progreso.
- El coordinador, al asignar una sesión, puede agregar N matrículas a la misma sesión.
- Si un estudiante del grupo se retira, no afecta a los demás.
- La "facturación empresarial" se calcula sumando las matrículas de estudiantes de la misma `StudentProfile.company`.

---

## ADR-004 — Bitácora en la sesión, no en la matrícula

**Fecha**: 2026-04  
**Estado**: Aceptado  
**Contexto**: La academia rota docentes mensualmente. Cada nuevo docente necesita saber qué se ha visto con el estudiante.

**Decisión**: `ClassLog` está relacionado con `ClassSession` (1:1), no con `Enrollment`. Para ver el histórico de un estudiante: query `ClassParticipant` por `enrollmentId`, join con `ClassSession` y `ClassLog`, ordenar por fecha.

**Consecuencias**:
- La rotación funciona: el nuevo docente ve todas las bitácoras anteriores.
- Una sesión tiene una única bitácora aunque sea grupal (todos los estudiantes del grupo ven el mismo tema).
- Notas específicas por estudiante van en `ClassParticipant.notes`.

---

## ADR-005 — Snapshots en exámenes (no versionado de preguntas)

**Fecha**: 2026-04  
**Estado**: Aceptado  
**Contexto**: Si la directora edita una pregunta, ¿qué pasa con los intentos pasados?

**Decisión**: Al sortear preguntas para una sesión, copiar `prompt`, `options` (JSON) y `acceptedAnswers` (JSON) a `TestSessionQuestion`. Los intentos viven con snapshots inmutables independientes del banco vivo.

**Consecuencias**:
- Duplicación mínima de datos (texto plano).
- Banco vivo es libre de evolucionar sin afectar histórico.
- `questionId` es opcional: si la pregunta se eliminó, el intento sigue funcionando.

---

## ADR-006 — Tarifa del docente como snapshot

**Fecha**: 2026-04  
**Estado**: Aceptado  
**Contexto**: Si cambia `TeacherProfile.hourlyRate` en mitad de un mes, las clases ya dictadas deberían seguir costando lo que costaban al dictarse.

**Decisión**: Al cerrar una sesión, copiar `TeacherProfile.hourlyRate` a `ClassParticipant.rateSnapshot`. Todos los cálculos de facturación usan el snapshot, nunca el valor actual.

**Consecuencias**:
- Historial de facturación estable.
- Cambios de tarifa tienen efecto solo prospectivamente.
- El `rateSnapshot` puede ser `null` en sesiones futuras (aún no cerradas).

---

## ADR-007 — Catálogo jerárquico de 3 niveles

**Fecha**: 2026-04  
**Estado**: Aceptado  
**Contexto**: El Excel inicial que se propuso tenía `Level` plano bajo `Language`. Al recibir la estructura real de la directora, se vio que tiene 3 niveles: tipo de programa → programa → nivel del programa.

**Decisión**: Modelar `Course` (tipo: General English, Business English, ...) → `Program` (libro: Time Zones, Market Leader, ...) → `ProgramLevel` (nivel concreto: Time Zones 1, Market Leader Elementary, ...). `CefrLevel` separado, solo lo usa el motor de pruebas.

**Consecuencias**:
- `Course.baseHours` y `pricePerHour` a nivel de tipo, no duplicados por programa.
- `Program.structureType` distingue `SEQUENTIAL` (Time Zones), `MODULAR` (Specialization), `SINGLE` (Kids).
- `ProgramLevel.cefrLevelCode` es string opcional, informativo, no FK.

---

## ADR-008 — Storage abstracto detrás de `StorageAdapter`

**Fecha**: 2026-04  
**Estado**: Aceptado  
**Contexto**: El proyecto empieza con storage local y luego migra a Cloudflare R2 por costos y escalabilidad.

**Decisión**: Interface `StorageAdapter` con métodos `upload`, `delete`, `getSignedUrl`, `exists`. Implementaciones `LocalAdapter` (disco) y `R2Adapter` (S3-compatible). Selección vía env var `STORAGE_DRIVER`.

**Consecuencias**:
- En la DB se guarda solo `storageKey`, nunca URL absoluta.
- URLs se generan al momento de servir (firmadas si aplica).
- Migración futura = copiar archivos del disco al bucket + cambiar env var, sin tocar código de negocio.

---

## ADR-009 — Email como cola con historial

**Fecha**: 2026-04  
**Estado**: Aceptado  
**Contexto**: Envío directo en el flujo de negocio es frágil (Resend caído rompe la matrícula).

**Decisión**: Modelo `EmailNotification` con `status=QUEUED`. Cron job procesa la cola y llama al `EmailProvider`. Reintentos con backoff. Nunca enviar dentro de una transacción Prisma.

**Consecuencias**:
- Negocio desacoplado de email provider.
- Fallos transitorios de email no rompen flujos.
- Histórico completo de notificaciones para auditoría.
- Modo demo (`DEMO_MODE=true`) fuerza provider "console" para no enviar correos reales.

---

## ADR-010 — Horarios recurrentes como `HH:mm`, no DateTime

**Fecha**: 2026-04  
**Estado**: Aceptado  
**Contexto**: `TeacherAvailability`, `StudentPreferredSchedule` y `ApplicationAvailability` son patrones recurrentes ("martes 19:00-20:00"), no momentos concretos.

**Decisión**: Almacenar como `dayOfWeek` (Int 0-6) + `startTime` (`"HH:mm"` string) + `endTime` (`"HH:mm"` string). Interpretado en `America/Guayaquil`.

**Consecuencias**:
- Sin zona horaria arrastrada ni fechas falsas.
- `ClassSession.scheduledStart` sí es `DateTime UTC` (es un momento concreto).
- Si en el futuro llegan docentes en otras zonas, se tomará decisión explícita (columna `timezone` por usuario, o convertir al aprobar).

---

## ADR-011 — Política de ausencia (pendiente de cliente)

**Fecha**: 2026-04  
**Estado**: Pendiente de decisión de la directora  
**Contexto**: ¿El estudiante ausente pierde la hora o puede recuperarla?

**Decisión temporal**: Opción A (ausente no consume). Configurable vía `AppSetting` `absence_counts_as_consumed = false`.

**Consecuencias**:
- Default no consume. La directora puede cambiarlo en el panel de settings cuando decida.
- Documentar el setting en la UI explicando implicaciones.

---

## ADR-012 — Visibilidad de resultados al candidato (configurable)

**Fecha**: 2026-04  
**Estado**: Aceptado  
**Contexto**: ¿El candidato ve su resultado o solo lo ven los administradores?

**Decisión**: Configurable en `AppSetting`:
- `candidate_can_view_results`: boolean.
- `candidate_result_detail_level`: `none | score_only | full`.

**Consecuencias**:
- Default conservador: `false` / `none`. La directora lo abre si decide.
- `full` mostraría al candidato qué respondió bien/mal (útil si el examen también sirve como auto-estudio).

---

## ADR-013 — Log de eventos sospechosos en exámenes (sin bloqueo)

**Fecha**: 2026-04  
**Estado**: Aceptado  
**Contexto**: La supervisión por videollamada es la defensa principal, pero conviene registrar señales adicionales.

**Decisión**: `TestSessionEvent` registra eventos de frontend (focus lost, copy attempt, fullscreen exit) de forma no bloqueante. La directora los ve al revisar resultados.

**Consecuencias**:
- No se frustra al candidato con falsos positivos (notificación del SO, por ejemplo).
- Se detecta patrón (15 pérdidas de foco de 30s cada una → señal de trampa).
- Implementación en frontend mediante listeners de `blur`/`visibilitychange` que POSTean asíncrono.

---

## ADR-014 — Payroll cerrado es inmutable

**Fecha**: 2026-04  
**Estado**: Aceptado  
**Contexto**: ¿Qué pasa si se edita retroactivamente una clase que ya está en un periodo cerrado?

**Decisión**: Opción A estricta. Una vez que un `PayrollPeriod` está `CLOSED`, las sesiones de ese rango no pueden modificar `hoursCounted` sin reabrir el periodo primero.

**Consecuencias**:
- Simple y sin ambigüedades contables.
- Si se descubre error en una clase ya facturada, la directora debe reabrir el periodo (acción auditada).
- Se considera reevaluar si operacionalmente genera fricción (pasar a opción B con `PayrollAdjustment` en periodo siguiente).

---

## ADR-015 — Aula (`ClassGroup`) como ciudadano de primera clase

**Fecha**: 2026-05-06
**Estado**: Aceptado (revoca la decisión previa "sin entidad Group separada")
**Contexto**: El modelo original tenía `EnrollmentSlot` y `TeacherAssignment.enrollmentId` por cada matrícula. Una clase grupal era un conjunto de matrículas que coordinación "agrupaba mentalmente" porque tenían los mismos slots y el mismo docente. Esto generaba dolor:
- Crear una clase grupal requería duplicar slots a mano en cada matrícula.
- Cambiar el docente del grupo requería N updates de `TeacherAssignment`.
- "¿Qué grupos hay activos?" no era una query directa — había que inferirlos por solapamiento de slots y docente.
- La coordinación piensa en aulas (ej. "TZ2 · Mar-Jue 18h con Carolina, 4 alumnos"), no en matrículas individuales.

**Decisión**: Introducir `ClassGroup` como entidad. Mover `slots` y `teacherAssignments` del `Enrollment` al `ClassGroup`. Una clase 1-a-1 es un aula con `enrollments.length === 1` — el modelo no tiene caso especial.

Reglas duras:
- No mezclar niveles: todas las matrículas de un aula referencian el mismo `ProgramLevel`.
- Aulas vacías permitidas (placeholder para planificar cohortes).
- Sin capacidad máxima en el modelo — coordinación autoregula.
- Nombre auto-generado al crear (`"TZ2 · Mar-Jue 18h"`), editable.

**Consecuencias**:
- Eliminado: `EnrollmentSlot`, `TeacherAssignment.enrollmentId`, módulo `teacher-assignments`, flow viejo de "alta de estudiante con asignación inmediata", página `/admin/estudiantes/[id]/asignar-docente`.
- Agregado: `ClassGroup`, `ClassGroupSlot`, `ClassGroupStatus`, `Enrollment.classGroupId?`, `TeacherAssignment.classGroupId`, `ClassSession.classGroupId`.
- El flow nuevo de inscripción: crear estudiante → matrícula al `ProgramLevel` → asignar a aula existente o crear nueva.
- Cambiar docente del aula es un solo update; las clases futuras se re-materializan a partir del aula, no de cada matrícula.
- Snapshots por sesión (`ClassParticipant.rateSnapshot`) siguen siendo la fuente de verdad para payroll — nada cambia ahí.

---

## Plantilla para nuevas ADR

```markdown
## ADR-NNN — Título corto

**Fecha**: YYYY-MM-DD
**Estado**: Propuesto | Aceptado | Revocado (por ADR-MMM)
**Contexto**: Qué situación motivó la decisión.

**Decisión**: Qué se decidió, expresado en presente.

**Consecuencias**: Qué implica esto para el código, los usuarios, el futuro.
```
