---
name: nextjs-app-conventions
description: Use this skill whenever creating or modifying files in src/app/ or src/modules/ in the CM English Instructor project. Covers the strict separation between routing (src/app) and business logic (src/modules), Server Actions vs Route Handlers, the .action.ts suffix convention, queries.ts pattern, authorization with requireRole/requireOwnership, and where each type of file belongs. Read before adding any feature.
---

# Next.js App Router conventions — CM English Instructor

Reglas estructurales del proyecto. La regla maestra: **`src/app/` es solo routing, la lógica vive en `src/modules/`**.

## Separación estricta

### `src/app/`

Solo contiene:
- `page.tsx` — pantallas de la app
- `layout.tsx` — layouts compartidos
- `loading.tsx`, `error.tsx`, `not-found.tsx`
- `route.ts` — solo para webhooks, cron, endpoints del motor de exámenes

**Lo que NO va en `src/app/`**:
- Llamadas directas a `prisma.*` — usar queries.ts del módulo correspondiente.
- Lógica de negocio — usar funciones puras del módulo.
- Reglas de validación duplicadas — usar Zod schemas del módulo.

### `src/modules/<dominio>/`

Lógica organizada por dominio. Cada módulo tiene esta estructura:

```
modules/teachers/applications/
├── schemas.ts           ← Zod schemas (validación cliente + servidor)
├── queries.ts           ← funciones de lectura (Prisma)
├── submit.action.ts     ← Server Action: postular
├── approve.action.ts    ← Server Action: aprobar
├── reject.action.ts     ← Server Action: rechazar
├── helpers.ts           ← funciones puras del dominio (opcional)
└── __tests__/
    └── *.test.ts
```

## Server Actions

### Naming

- Sufijo obligatorio: `.action.ts`
- Una action por archivo (mejor para tree-shaking y testabilidad).
- Nombre del archivo = verbo + sustantivo: `approve.action.ts`, `submit.action.ts`, `close-period.action.ts`.

### Estructura tipo

```typescript
'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/modules/auth/guards'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const InputSchema = z.object({
  applicationId: z.string().cuid(),
  rate: z.number().positive(),
  approvedLevelIds: z.array(z.string().cuid()).min(1),
})

export async function approveTeacherApplication(input: z.infer<typeof InputSchema>) {
  const session = await requireRole(['COORDINATOR', 'DIRECTOR'])
  const validated = InputSchema.parse(input)
  
  const result = await prisma.$transaction(async (tx) => {
    // ... lógica
  })
  
  // Side effects FUERA de la transacción
  await enqueueEmail({ ... })
  
  revalidatePath('/admin/postulaciones')
  return { success: true, data: result }
}
```

### Reglas de Server Actions

1. **Siempre validar con Zod** — el input no es confiable, ni siquiera viniendo de un form propio.
2. **Siempre verificar autorización** — `requireRole`, `requireOwnership`. Nunca asumir que el usuario tiene permiso porque la UI no le mostró el botón.
3. **Operaciones multi-tabla en transacción** — `prisma.$transaction(async tx => ...)`.
4. **Side effects (email, archivos externos) FUERA de la transacción** — si el email falla, no hacer rollback de la operación de negocio.
5. **`revalidatePath` o `revalidateTag`** después de mutar — sin esto, los componentes RSC mostrarán datos viejos.
6. **Devolver `{ success, data, error }` discriminado** — facilita manejo en el cliente.

## Route Handlers (`route.ts`)

Solo cuando NO se puede usar Server Action:

- **Webhooks externos** (Resend, R2, Vercel Cron).
- **Endpoints del motor de exámenes** (necesitan estar disponibles para llamadas frecuentes desde JS del cliente sin overhead de Server Actions).
- **Endpoints de descarga** (CSV, PDF) que necesitan controlar headers HTTP.

Siempre validar:
- Origen (CORS, secret de cron, firma de webhook).
- Body con Zod.
- Rate limit si aplica.

## Queries de lectura (`queries.ts`)

Para Server Components y para datos que se cargan en una página:

```typescript
// modules/enrollments/queries.ts
import { prisma } from '@/lib/prisma'
import { cache } from 'react'

export const getEnrollmentById = cache(async (id: string) => {
  return prisma.enrollment.findUnique({
    where: { id },
    include: { student: { include: { user: true } }, programLevel: { include: { program: { include: { course: true } } } } },
  })
})
```

- Usa `cache()` de React para deduplicar en el mismo request.
- Devuelve datos serializables (no clases, no Date objects sin tipar).
- Si la página no necesita un dato, NO incluirlo en `include` (cuesta DB y serialización).

## Layouts y route groups

Carpetas con paréntesis no cuentan en URL:

- `(public)` — sin auth, layout público
- `(admin)` — guard director/coordinador, layout dashboard admin
- `(teacher)` — guard docente, layout docente
- `(student)` — guard estudiante, layout estudiante

El guard se pone en `layout.tsx` del grupo:

```typescript
// src/app/(admin)/layout.tsx
import { requireRole } from '@/modules/auth/guards'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['DIRECTOR', 'COORDINATOR'])
  return <AdminShell>{children}</AdminShell>
}
```

## Importaciones

- Solo paths absolutos: `@/modules/...`, `@/lib/...`, `@/components/...`. **Nunca** `../../../`.
- `import 'server-only'` al tope de archivos que NO deben llegar al cliente (queries, lib/prisma).
- Componentes Client se marcan con `'use client'` al inicio del archivo, lo más arriba posible en el árbol.

## Componentes

### Reutilizables (`src/components/`)

- `ui/` — primitives shadcn/ui (Button, Dialog, Input, etc.).
- `forms/` — components de form de alto nivel (CourseForm, EnrollmentForm).
- `calendar/` — vistas y selectores de calendario/disponibilidad.
- `test-engine/` — componentes específicos del motor de exámenes.
- `tables/` — wrappers sobre TanStack Table.
- `layout/` — sidebar, topbar, app shell.

### Página-específicos

Si un componente solo se usa en una página, vive **junto a esa página**:

```
src/app/(admin)/postulaciones/
├── page.tsx
├── _components/
│   ├── ApplicationsList.tsx
│   └── ApplicationDetail.tsx
```

Carpeta con prefijo `_` para excluirla del routing.

## Estado y data fetching

- **Lecturas**: Server Components con `queries.ts`, no `useEffect`.
- **Mutaciones**: Server Actions desde formularios o handlers de cliente.
- **Estado global cliente**: minimizar. Si hace falta, Zustand o React Context, no Redux.
- **Optimistic updates**: `useOptimistic` de React 19.

## Errores comunes a evitar

- ❌ `prisma.user.findMany()` directo en `page.tsx` — debe ser `getUsers()` del módulo.
- ❌ Server Action sin validación Zod.
- ❌ Server Action sin guard de autorización.
- ❌ Email enviado dentro de `prisma.$transaction`.
- ❌ Componente Client (`'use client'`) que importa de `lib/prisma` (rompe el build).
- ❌ `revalidatePath` olvidado tras mutación.
- ❌ Importaciones relativas con `../../../`.
- ❌ Una sola Server Action que hace 5 cosas distintas — separar.
