# CM English Instructor — Contexto para Claude Code

Este archivo es la fuente de verdad para cualquier agente trabajando en este repo. Léelo antes de escribir código.

## Qué es este proyecto

Plataforma de gestión académica para **CM English Instructor** (academia de inglés y español dirigida por Carolina Monsalve, Certified English & Spanish Instructor). El público objetivo son empresas, ejecutivos, adultos, adolescentes y niños — con énfasis inicial en el segmento empresarial/ejecutivo.

Reemplaza a un proceso manual hoy basado en Word, Zoom y hojas de cálculo: inscripción con prueba de ubicación, matrícula, asignación de docente con cruce de disponibilidad, dictado de clases virtuales/presenciales/híbridas con bitácora, certificación de suficiencia, y facturación al docente.

## Stack

- **Framework**: Next.js 15 (App Router) — full-stack, React 19
- **ORM**: Prisma + PostgreSQL
- **Auth**: Auth.js v5 (NextAuth) con credenciales + sesiones en DB
- **UI**: Tailwind CSS v4 + shadcn/ui, con tokens personalizados de marca
- **Validación**: Zod (compartida cliente/servidor)
- **Forms**: React Hook Form + Zod resolver
- **Tablas**: TanStack Table
- **Calendario**: FullCalendar o react-big-calendar (pendiente de decisión al llegar al módulo)
- **Email**: Resend (provider abstracto detrás de interfaz — ver `src/lib/email/`)
- **Jobs / cron**: Vercel Cron para tareas simples; Inngest si crece la complejidad
- **Storage**: abstraído con `StorageAdapter` — `local` al inicio, migrable a Cloudflare R2
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Deploy objetivo**: Vercel (app) + Neon o Supabase (Postgres)

## Reglas fundamentales

### 1. Lógica de negocio NO vive en `/src/app`

La carpeta `/src/app` es solo routing. Recibe requests, invoca lógica que vive en `/src/modules/<dominio>/`, devuelve respuesta. Nunca consultas Prisma ni lógica de cálculo directamente en páginas o route handlers.

```
✅ page.tsx → queries.getEnrollmentById(id) → render
❌ page.tsx → prisma.enrollment.findUnique(...) → render
```

### 2. Dónde va cada cosa

| Tipo | Ubicación | Sufijo |
|---|---|---|
| Server Action | `src/modules/<dominio>/<feature>.action.ts` | `.action.ts` |
| Query de lectura | `src/modules/<dominio>/queries.ts` | — |
| Función pura | `src/modules/<dominio>/<nombre>.ts` | — |
| Validación Zod | `src/modules/<dominio>/schemas.ts` | — |
| Tests | `src/modules/<dominio>/__tests__/` | `.test.ts` |
| Componente UI reutilizable | `src/components/` | — |
| Componente de una página | Junto a `page.tsx` | — |
| Route handler (API) | `src/app/api/.../route.ts` | Solo webhooks, cron, endpoints del examen |

### 3. Todas las operaciones multi-tabla van en transacción

Usa `prisma.$transaction(async (tx) => { ... })`. Las funciones que hacen I/O compuesto reciben `tx` como primer parámetro para poder componerse:

```typescript
async function closeClassSession(tx: Prisma.TransactionClient, ...) { ... }
```

### 4. Autorización centralizada

Nunca `if (session.user.role !== 'X')` inline. Usa helpers de `src/modules/auth/guards.ts`:

```typescript
await requireRole(['DIRECTOR', 'COORDINATOR'])
await requireOwnership(enrollment, user)
```

### 5. Snapshots cuando la referencia puede cambiar

- Preguntas en un intento de examen → snapshot del prompt/opciones en `TestSessionQuestion`.
- Tarifa del docente al cerrar clase → snapshot en `ClassParticipant.rateSnapshot`.
- No se edita histórico retroactivamente sin crear un nuevo registro.

### 6. Dinero y horas en Decimal

Nunca `float` para dinero u horas. Siempre `Decimal` de Prisma (`@db.Decimal(10,2)` para dinero, `@db.Decimal(6,2)` para horas).

### 7. Soft-delete por defecto para entidades con historia

Users, Enrollments, Questions, ClassSessions, TestSessions: nunca hard-delete. Usa `isActive` / `deletedAt` / `status = CANCELLED`. Hard-delete solo en entidades sin historia (AppSetting, Holiday).

### 8. Zona horaria

- **En base de datos**: todo UTC.
- **En UI**: mostrar en `America/Guayaquil`.
- **Disponibilidad recurrente** (`TeacherAvailability`, `StudentPreferredSchedule`): `dayOfWeek` (0-6) + `startTime`/`endTime` en formato `"HH:mm"` — se asume hora local de Guayaquil. No almacenar como `DateTime` porque son patrones, no momentos.

## Identidad de marca

La marca es **premium editorial con calidez humana**. No juvenil (no Duolingo), no corporate frío (no SAP), no startup genérica. Referencias: Linear, Stripe, Pitch.

**Paleta (uso obligatorio)**:
- `#233641` Ink — protagonista (sidebar, topbar, fondos oscuros)
- `#279F89` Teal — acento de marca, solo para CTAs y estados activos
- `#267A6F` Teal deep — hover/pressed
- `#FAF8F5` Bone — fondo de área de trabajo (no white puro)
- Neutrals entre `#EAECED` y `#3E4F58` derivados del ink

**Tipografía (prohibido Inter/Roboto)**:
- Display: **Fraunces** (serif, Google Fonts)
- Body/UI: **Geist** (sans-serif)
- Mono: **Geist Mono**

**Anti-patrones visuales** — rechazar explícitamente:
- Gradientes (especialmente purple gradient)
- Drop shadows en cards (usar bordes `0.5px` / `1px`)
- Emojis o ícono 3D
- Ilustraciones de undraw/storyset
- Border-radius > 12px en controles (feel infantil)
- Animaciones spring/bounce exageradas

Ver `docs/design-brief.md` para especificación completa.

## Skills recomendadas (instalar en Claude Code al abrir el proyecto)

Estas skills ya vienen incluidas en la carpeta `.claude/skills/` (custom del dominio). Además, instala las oficiales:

```bash
# Base — todas obligatorias
npx skills add anthropics/skills/frontend-design
npx skills add vercel-labs/agent-skills/web-design-guidelines
npx skills add vercel-labs/agent-skills/react-best-practices
npx skills add vercel-labs/agent-skills/next-best-practices
npx skills add vercel-labs/agent-skills/composition-patterns
```

Ver `docs/setup.md` para el proceso completo de bootstrap.

## Flujos críticos documentados

Los 6 flujos más delicados del sistema están en `docs/flows/`. Léelos antes de implementar módulos relacionados:

1. `01-teacher-onboarding.md` — postulación pública → aprobación → alta de docente
2. `02-student-enrollment.md` — invite → prueba → revisión → matrícula
3. `03-test-session.md` — motor de exámenes con token, expiración, snapshot, anti-trampa
4. `04-teacher-assignment.md` — cruce de disponibilidad y generación de sesiones
5. `05-class-session.md` — asistencia + bitácora + actualización de contadores (transaccional)
6. `06-payroll.md` — facturación del docente con tarifa snapshot

## Orden de implementación sugerido

Por módulos verticales (schema → actions → UI → tests), no por capas. Orden:

1. Auth + usuarios
2. Catálogo (languages, cefr levels, courses, programs, program levels) + seed
3. Postulación y gestión de docentes
4. Banco de preguntas + plantillas de examen
5. Motor de exámenes + invite token
6. Inscripción de estudiante
7. Disponibilidad y asignación de docente
8. Sesiones de clase + bitácora + asistencia
9. Facturación
10. Notificaciones por email
11. Repositorio de materiales
12. Configuración global + panel de settings

## Decisiones importantes tomadas

Ver `docs/decisions.md` para el log completo. Las más críticas:

- Un usuario = un rol (sin M:N).
- Clases grupales modeladas como `ClassSession` con N `ClassParticipant`, sin entidad `Group` separada.
- Bitácora (`ClassLog`) vive en la sesión, no en la matrícula — permite rotación mensual de docentes.
- Banco de preguntas con snapshot por intento — inmutable después de sorteo.
- Catálogo con 3 niveles: `Course` (tipo) → `Program` (Time Zones, Life, etc.) → `ProgramLevel` (niveles específicos del programa).
- `CefrLevel` separado: solo lo usan las pruebas de ubicación, no el catálogo de cursos.
- Storage abstraído detrás de `StorageAdapter` interface.
- Email abstraído detrás de `EmailProvider` interface.
- Rate del docente: snapshot en `ClassParticipant.rateSnapshot` al cerrar sesión.
- Cálculo de payroll: tiempo real por rango de fechas; `PayrollPeriod` solo para cerrar con monto inmutable.

## Qué NO hacer

- No usar Inter como fuente (está explícitamente prohibido).
- No crear componentes con >5 props booleanas. Usa compound components o variantes.
- No hacer queries Prisma fuera de `modules/<dominio>/queries.ts`.
- No poner lógica de negocio en componentes React ni en páginas.
- No hacer hard-delete de entidades con historia.
- No almacenar credenciales de plataformas externas (NG Learning, Pearson) — el estudiante las gestiona por fuera.
- No enviar emails dentro de una transacción Prisma — encolar primero, enviar después.
- No asumir que `ProgramLevel.code` es un número. Puede ser "1", "Elementary", "Presenting", o cualquier string.
- No introducir nuevas dependencias sin revisar el stack declarado arriba.
