---
name: prisma-schema-conventions
description: Use this skill whenever modifying prisma/schema.prisma in the CM English Instructor project, adding new models, fields, enums, or relations, or generating Prisma migrations. Covers ID strategy (cuid), money/hours decimal precision, soft-delete patterns, snapshot patterns for immutable history, indexing rules, and timezone handling for recurring schedules vs concrete moments. Read before any schema change.
---

# Prisma schema conventions — CM English Instructor

Reglas obligatorias para evolucionar el schema sin romper convenciones del proyecto. Si vas a tocar `prisma/schema.prisma`, lee esto primero.

## IDs

- **Siempre** `String @id @default(cuid())`. Nunca autoincrement.
- Razón: URLs seguras, no expone conteo de registros, mergeable entre entornos.
- Excepción: relaciones M:N usan PK compuesta `@@id([a, b])`.

## Tipos numéricos

- **Dinero**: `Decimal @db.Decimal(10, 2)` — soporta hasta $99,999,999.99.
- **Totales grandes** (payroll acumulado): `Decimal @db.Decimal(12, 2)`.
- **Horas**: `Decimal @db.Decimal(6, 2)` — soporta hasta 9999.99h con precisión a 0.01h.
- **Horas por sesión** (más acotado): `Decimal @db.Decimal(4, 2)`.
- **NUNCA** usar `Float` para dinero u horas.

## Soft-delete

Entidades con historia usan uno de estos patrones (no inventar otros):

1. **`isActive Boolean @default(true)`** — para entidades que se "dan de baja" sin perder histórico (`TeacherProfile`, `Course`, `Question`, `TestTemplate`).
2. **`status` enum con valor `CANCELLED` o `INACTIVE`** — para entidades con ciclo de vida (`Enrollment`, `ClassSession`, `EmailNotification`).
3. **`deletedAt DateTime?`** — solo si se necesita timestamp del borrado.

**Nunca** `onDelete: Cascade` en entidades con historia. Solo en relaciones que son extensiones del padre (un `ClassParticipant` muere con su `ClassSession`, sí; una `Enrollment` no muere con un `User`, no).

## Snapshots para inmutabilidad histórica

Cuando una entidad referencia algo que puede cambiar pero el histórico no debe alterarse, **copiar valores como columnas** en vez de relacionar:

- `ClassParticipant.rateSnapshot` — copia de `TeacherProfile.hourlyRate` al cerrar la sesión.
- `TestSessionQuestion.promptSnapshot`, `optionsSnapshot` (Json), `acceptedAnswersSnapshot` (Json) — copia completa de la pregunta al sortear.

La FK al original sigue existiendo (para trazabilidad) pero es **opcional**: si el original se borra/edita, el snapshot sigue intacto.

## Timestamps

- `createdAt DateTime @default(now())` en toda entidad creada por usuario.
- `updatedAt DateTime @updatedAt` solo si la entidad tiene edición real.
- Entidades de log/snapshot solo tienen `createdAt` (no se editan).

## Índices

Agregar `@@index` para:
- Toda columna que aparezca en `WHERE` frecuente (status, role, isActive).
- Toda FK que aparezca en `WHERE` (no es automático en Prisma para todas las DBs).
- Combinaciones (`@@index([teacherId, scheduledStart])` para queries de calendario).

No agregar índices "por las dudas" — cada índice tiene costo de escritura.

## Zona horaria — patrón obligatorio

Distingue dos casos:

### Patrones recurrentes ("todos los martes 19:00")

Modelar como:
```prisma
dayOfWeek Int       // 0=domingo, 6=sábado
startTime String    // "HH:mm" en hora de Guayaquil
endTime   String    // "HH:mm" en hora de Guayaquil
```

NUNCA `DateTime` para esto. Razón: un patrón no es un momento concreto.

### Momentos concretos ("clase del martes 14 de mayo a las 19:00")

`DateTime` UTC en la DB. La conversión a hora local de Guayaquil ocurre solo en la UI (con `date-fns-tz`).

## Relaciones M:N

Crear modelo intermedio explícito (no usar `@relation` implícita) si el modelo intermedio puede tener atributos propios o ser auditado. Ejemplo:

```prisma
model TeacherLevel {
  teacherId String
  levelId   String
  teacher   TeacherProfile @relation(fields: [teacherId], references: [userId])
  level     CefrLevel      @relation(fields: [levelId], references: [id])
  @@id([teacherId, levelId])
}
```

## Enums vs strings

- Usa `enum` cuando el conjunto de valores es **cerrado y conocido al diseño** (Role, Modality, AttendanceStatus, EnrollmentStatus).
- Usa `String` cuando el conjunto puede crecer con uso (topics de preguntas, categorías de AppSetting).

## Json fields

Permitidos para snapshots inmutables (`optionsSnapshot`, `acceptedAnswersSnapshot`, `metadata` de `AuditLog` y `EmailNotification.templateData`). NO usar Json para datos consultables — esos van en columnas estructuradas.

## Migraciones

- **Crear con nombre descriptivo**: `pnpm prisma migrate dev --name add_payroll_period`.
- **Nunca editar migraciones aplicadas**. Si un cambio resultó mal, crear una nueva migración correctiva.
- Antes de generar la migración, validar:
  ```bash
  pnpm prisma validate
  pnpm prisma format
  ```
- En CI: `pnpm prisma migrate deploy` (no `dev`).
- **Drift detection**: si Prisma detecta cambios manuales en la DB no reflejados en migraciones, NO usar `--force` para sobreescribir. Investigar primero.

## Cuándo agregar un nuevo modelo

Antes de agregar un modelo, preguntarse:

1. ¿Esta entidad tiene identidad propia que persiste fuera de su contenedor? (Si la respuesta es "no, es solo metadata de X", es una columna o un Json en X, no un modelo nuevo).
2. ¿Tiene ciclo de vida propio (creación, edición, borrado independiente)?
3. ¿Hay queries que la consultan sin pasar por su contenedor?

Si las tres respuestas son sí, modelo nuevo. Si no, columna o Json.

## Documentación obligatoria

Cualquier cambio al schema debe reflejarse en `docs/data-model.md` **en el mismo PR**. Si el cambio implica una decisión arquitectónica, agregar ADR en `docs/decisions.md`.
