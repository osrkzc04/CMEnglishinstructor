# CM English Instructor — Modelo de datos

> Documentación del esquema Prisma. Cuando se proponga cualquier cambio al
> modelo, **actualizar este archivo primero**, luego implementar. Sin esto,
> el schema deriva y al año nadie recuerda por qué las decisiones están como
> están.

---

## Vista general

El modelo está organizado en 4 bloques conceptuales:

1. **Identidad** — usuarios, roles, postulación y perfiles.
2. **Catálogo y clases** — cursos, programas, matrículas, sesiones de clase.
3. **Exámenes** — banco de preguntas, plantillas, invitaciones y sesiones de prueba.
4. **Soporte operativo** — facturación, configuración, notificaciones, auditoría.

Total: 30+ modelos. El archivo canónico es `prisma/schema.prisma`.

---

## Convenciones transversales

- **IDs**: `cuid()`. Permite URLs seguras y evita colisiones en merges.
- **Dinero**: `Decimal(10, 2)`. **Nunca `Float`**.
- **Horas**: `Decimal(6, 2)` (hasta 4 decimales de precisión para casos tipo 0.75h = 45 min).
- **Soft-delete** en entidades con historia: `isActive`, `deletedAt`, o `status` con enum que incluya `CANCELLED`/`INACTIVE`.
- **Snapshots** cuando la referencia puede cambiar pero el histórico no debe: preguntas de examen, tarifa del docente al cerrar sesión.
- **Timestamps**: `createdAt` en todas las entidades creadas por el usuario, `updatedAt` cuando hay edición.
- **Transaccionalidad**: toda operación multi-tabla va en `prisma.$transaction`.

---

## Bloque 1 — Identidad

### `User`

Usuario base del sistema. **Un usuario = un rol**. El campo `role` es enum: `DIRECTOR | COORDINATOR | TEACHER | STUDENT`.

- La directora tiene rol `DIRECTOR` (hereda permisos de coordinador + puede dictar clases).
- Si el director también dicta, se le asocia un `TeacherProfile` opcional.
- Contraseña hasheada con bcrypt (`passwordHash`).
- `passwordHash` es opcional porque los candidatos a prueba acceden solo con token (no tienen cuenta).

### `TeacherApplication`

Formulario de postulación pública. **Existe antes de que haya `User`**.

- Al aprobar, la transacción crea `User` + `TeacherProfile` + disponibilidad y vincula `userId` de vuelta.
- Al rechazar, se guarda `rejectionReason` y no se crea `User`.

### `TeacherProfile`

Datos específicos del docente. Relación 1:1 con `User` (`userId` como PK).

- `hourlyRate` por docente (permite tarifas negociadas).
- `isActive` para "dar de baja" sin perder histórico.

### `TeacherAvailability` / `TeacherUnavailability`

- `TeacherAvailability` = **patrón semanal recurrente**: `dayOfWeek` (0=domingo, 6=sábado) + `startTime`/`endTime` en `"HH:mm"`.
- `TeacherUnavailability` = **bloques concretos** (vacaciones, ausencias): `DateTime` range.

Las horas son siempre hora de Guayaquil. No se almacenan con timezone porque son patrones, no momentos concretos.

### `StudentProfile` / `StudentPreferredSchedule`

Simétrico al docente pero más simple. `StudentPreferredSchedule` se llena durante la matrícula y se usa para el algoritmo de cruce de disponibilidad.

---

## Bloque 2 — Catálogo y clases

### Jerarquía de 3 niveles

Esta es una de las decisiones más importantes del modelo. El catálogo **no es plano**:

```
Language  (English, Español)
  └─ Course  (General English, Business English, Kids Learning, Español)
       └─ Program  (Time Zones, Life, Market Leader, Specialization, ...)
            └─ ProgramLevel  (Time Zones 1, Market Leader Elementary, Presenting, ...)
```

Cada nivel aporta algo:

- `Language`: el idioma que se enseña.
- `Course`: "tipo de programa" — define `baseHours`, `pricePerHour`, `classDuration`.
- `Program`: libro o plataforma específica — tiene `publisher`, `platformUrl`, y un `structureType` que distingue programas progresivos (Time Zones), modulares (Specialization) e integrales (Kids).
- `ProgramLevel`: nivel específico dentro del programa, que es lo que se matricula.

### `CefrLevel` — separado y paralelo

Niveles CEFR (`A1`, `A2`, `B1`, `B2`, `C1`, `C2`) existen en su propia tabla y **solo los usa el motor de pruebas de ubicación**.

No están en el catálogo porque la directora trabaja con niveles concretos de programa (Time Zones 1, Market Leader Elementary, etc.), no con CEFR abstracto. `ProgramLevel.cefrLevelCode` es un string opcional que permite al coordinador cruzar el resultado de la prueba ("el candidato es B1") con el nivel apropiado del programa elegido ("Time Zones 3 es B1").

### `Enrollment`

Una matrícula conecta un `StudentProfile` con un `ProgramLevel`.

- `modality` es **propiedad de la matrícula**, no del programa. El mismo "Time Zones 2" puede dictarse virtual a un estudiante y presencial a otro.
- `contractedHours` = `Course.baseHours` + `ExtraHours` aprobadas.
- `consumedHours` está **denormalizado** por performance (se actualiza al cerrar cada sesión en transacción). Saldo = `contractedHours - consumedHours`.
- `placementTestId` opcional vincula la matrícula con la prueba de ubicación que la originó.

### `ClassSession` + `ClassParticipant` + `ClassLog`

Una sesión de clase puede tener N participantes (caso grupal empresarial). Cada `ClassParticipant` trackea la asistencia individual y las horas consumidas.

- `ClassParticipant.rateSnapshot`: copia de `TeacherProfile.hourlyRate` al cerrar la sesión. Asegura facturación con la tarifa vigente al momento de dictar, no la actual.
- `ClassLog` (bitácora) vive en la sesión, **no en la matrícula**. Esto permite la rotación mensual de docentes: el histórico se consulta filtrando por `ClassParticipant.enrollmentId` y ordenando por fecha — da todas las bitácoras del estudiante sin importar qué docente las escribió.

### `Holiday`

Feriados informativos. El sistema **no bloquea** programar clases en feriados — solo avisa.

### `Material`

Repositorio de archivos (PDFs de editorial, audios, etc.). Puede estar vinculado a `ProgramLevel` específico o a `Course` genérico (o a ninguno, material universal).

- `storageKey` es la key abstracta del `StorageAdapter` — **nunca** una URL absoluta. Permite migrar entre storage local y R2 sin tocar la DB.

---

## Bloque 3 — Exámenes

### Banco de preguntas (`Question`)

Vive asociado a un `CefrLevel`. Tipos soportados:

- `MULTIPLE_CHOICE` con `QuestionOption[]` (una correcta, el resto distractores).
- `FILL_IN` con `QuestionFillAnswer[]` (puede haber múltiples respuestas aceptables, con `caseSensitive` configurable por respuesta).

Soft-delete con `isActive`. Preguntas nunca se borran — solo se desactivan. Los intentos pasados mantienen la pregunta vía snapshot.

### `TestTemplate`

Define cómo se compone una prueba: qué filtros de tópico, cuántas preguntas sortear, cuánto tiempo. `purpose` distingue `PLACEMENT` de `CERTIFICATION`.

### Invitaciones y token

`InviteToken` contiene:

- `token`: string aleatorio de ~32 bytes hex, va en la URL pública.
- `expiresAt`: normalmente `createdAt + 24h` (configurable vía `AppSetting`).
- `usedAt`: se marca al iniciar la sesión de prueba.

### `TestSession` con snapshot

El intento real. Cuando el candidato comienza:

1. Se sortean N preguntas del banco según los filtros del template.
2. Por cada pregunta sorteada se crea un `TestSessionQuestion` con **snapshot completo** (`promptSnapshot`, `optionsSnapshot` JSON, `acceptedAnswersSnapshot` JSON, `pointsSnapshot`, `typeSnapshot`).

A partir de ahí, si la directora edita o elimina preguntas del banco, **los intentos pasados no se alteran**. `questionId` es opcional: si la pregunta se eliminó, sigue existiendo como snapshot en el intento.

### `deadline` como fuente de verdad

`TestSession.deadline` = `startedAt + timeLimitMinutes`. Toda validación de tiempo se hace server-side contra ese timestamp. El frontend solo muestra un countdown cosmético. No se depende de jobs para expirar: cualquier consulta a la sesión después del deadline la marca `TIMED_OUT` y la califica con lo que haya. Un cron de respaldo corre cada 5 min para cubrir candidatos que cerraron el navegador.

### `TestSessionEvent`

Log de eventos sospechosos durante el examen (pérdida de foco, intento de copy/paste, salir de fullscreen). **No bloquea nada**, solo informa a la directora al revisar. La videollamada de supervisión es la defensa principal; esto es defensa en profundidad.

---

## Bloque 4 — Soporte operativo

### `PayrollPeriod`

Facturación del docente es principalmente **vista calculada** (suma `hoursCounted × rateSnapshot` sobre `ClassParticipant` en el rango). `PayrollPeriod` solo existe para **congelar** un periodo: una vez cerrado, los totales son inmutables.

- `status = DRAFT` → todavía se pueden editar sesiones del periodo.
- `status = CLOSED` → las sesiones del periodo ya no pueden modificar `hoursCounted` sin abrir el periodo primero.
- `status = PAID` → pagado y archivado.

### `AppSetting` — key-value tipado

Un solo modelo para todas las configuraciones parametrizables. Cada setting tiene `type` (`STRING`, `NUMBER`, `BOOLEAN`, `JSON`) que permite castear el valor. Settings iniciales (ver `prisma/seed.ts`):

| Key                                 | Default  | Descripción                      |
| ----------------------------------- | -------- | -------------------------------- |
| `default_class_duration_minutes`    | `45`     | Duración de clase                |
| `default_price_per_hour`            | `25`     | Precio base                      |
| `invite_token_expiration_hours`     | `24`     | Validez del link de prueba       |
| `candidate_can_view_results`        | `false`  | ¿Candidato ve su resultado?      |
| `candidate_result_detail_level`     | `none`   | `none` \| `score_only` \| `full` |
| `absence_counts_as_consumed`        | `false`  | ¿Ausencia resta horas?           |
| `notification_weekly_schedule_day`  | `sunday` | Día envío de cronograma          |
| `notification_weekly_schedule_hour` | `18`     | Hora envío                       |
| `reminder_class_hours_before`       | `2`      | Horas antes del recordatorio     |
| `log_edit_window_hours`             | `24`     | Ventana para editar bitácora     |

### `EmailNotification` — cola con historial

- Crear notificación = insertar fila con `status=QUEUED` y `scheduledFor`.
- Cron job recoge `QUEUED` con `scheduledFor <= now()`, envía vía `EmailProvider`, actualiza estado.
- Si falla, incrementa `attempts` y reintenta con backoff. Después de 3 intentos falla definitivamente.
- **Nunca** enviar emails dentro de una transacción Prisma — encolar primero, enviar después.

### `AuditLog`

Opcional pero recomendado. Registra `action` (ej: `enrollment.create`), `entityType`, `entityId`, y `metadata` JSON con el diff relevante. No es obligatorio usarlo en v1, pero tenerlo en el schema cuesta poco y es invaluable cuando alguien pregunta "¿quién cambió este puntaje?".

---

## Decisiones de diseño destacadas

### ¿Por qué un usuario = un rol?

Decisión explícita del cliente. La directora ocasionalmente dicta clases, pero se modela como `DIRECTOR` con permisos que incluyen dictar, no como doble rol. Simplifica las queries de autorización.

### ¿Por qué no una entidad `Group`?

Clases grupales (empresas con varios empleados) se modelan con N `ClassParticipant` sobre la misma `ClassSession`. Cada participante sigue teniendo su propia `Enrollment` individual, con su asistencia y conteo de horas propio. Esto evita duplicar lógica y permite que cada empleado progrese a su ritmo en la misma clase.

### ¿Por qué snapshots en vez de versionado?

Considerado versionado de preguntas pero resultó más complejo. Snapshot = copiar `prompt` + opciones como JSON al momento del sorteo. Duplica datos pero es simple, robusto y desacopla el histórico completamente del banco vivo.

### ¿Por qué `Course` y `Program` separados y no un solo modelo?

El Excel de la directora tiene explícitamente 3 niveles (tipo de programa → programa → nivel). Combinarlos haría que "Time Zones" y "Market Leader" se dupliquen si sirven a varios tipos de curso, y haría imposible parametrizar `baseHours` a nivel de tipo.

### ¿Por qué `ProgramLevel.cefrLevelCode` es string y no FK?

Porque es **informativo**, no vinculante. El coordinador puede decidir matricular a alguien B1 en Market Leader Intermediate aunque su mapeo CEFR diga otra cosa. Si fuera FK, cualquier cambio cascadearia bloqueado por integridad referencial.

### ¿Por qué `structureType` enum en `Program`?

- `SEQUENTIAL`: Time Zones 1→2→3. Progresión lineal.
- `MODULAR`: Specialization. Módulos independientes que se pueden tomar sueltos.
- `SINGLE`: Kids Integral. Un nivel único sin progresión.

Sin este enum, la UI tendría que adivinar cómo presentar los niveles. Con él, puede decidir: lista numerada para SEQUENTIAL, grilla de opciones para MODULAR, solo el programa sin niveles para SINGLE.

### ¿Por qué `consumedHours` denormalizado?

Porque la query "¿cuántas horas le quedan al estudiante?" se ejecuta decenas de veces por sesión (al mostrar dashboard, al validar que se puede programar más clases, etc.). Calcularla sumando `ClassParticipant.hoursCounted` cada vez sería caro. Se actualiza en transacción al cerrar cada sesión, manteniendo consistencia.

---

## Qué NO está en el modelo (y por qué)

- **Calificaciones finales del curso**: la directora certifica manualmente. No hay concepto de "aprobado" automático.
- **Credenciales de plataformas externas** (NG Learning, Pearson): el estudiante las gestiona por fuera. Solo guardamos `platformUrl` del programa.
- **Recursos financieros del estudiante** (facturas, pagos): fuera de alcance v1. Se lleva manualmente o en otro sistema. El sistema solo calcula lo que el docente cobra.
- **Mensajería interna**: fuera de alcance. Comunicación entre docente y estudiante se hace por fuera.
- **Ranking/gamificación**: la marca es premium editorial, no gamificada. No hay puntos, medallas, streaks.

---

## Glosario

- **Curso / Course**: "tipo de programa" según la directora. No confundir con "class session" (sesión individual).
- **Programa / Program**: libro + plataforma específica (Time Zones, Market Leader, ...).
- **Nivel del programa / ProgramLevel**: nivel concreto dentro de un programa (Time Zones 1, Market Leader Elementary, ...).
- **CEFR level**: nivel abstracto europeo (A1-C2) usado solo en pruebas.
- **Matrícula / Enrollment**: vínculo entre estudiante y ProgramLevel.
- **Sesión de clase / ClassSession**: clase individual de 45 min (o la duración configurada).
- **Bitácora / ClassLog**: notas del docente sobre lo visto en la clase.
- **Sesión de prueba / TestSession**: intento de una persona rindiendo un TestTemplate.
