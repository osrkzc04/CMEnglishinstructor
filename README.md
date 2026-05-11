# CM English Instructor

Plataforma de gestión académica para **Carolina Monsalve — CM English Instructor**. Inscripciones, pruebas de ubicación/certificación, gestión de docentes, dictado de clases virtuales/presenciales, bitácoras, facturación.

> *Helping Everyone Communicate*

## Stack

Next.js 15 · React 19 · TypeScript · Prisma · PostgreSQL · Auth.js v5 · Tailwind v4 · shadcn/ui · Zod · React Hook Form · Resend · Vitest · Playwright

## Setup rápido

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores locales

# 3. Levantar la base de datos (Docker local opcional)
docker compose up -d   # si usas docker-compose para Postgres

# 4. Migrar schema
pnpm prisma migrate dev

# 5. Poblar con datos iniciales (catálogo, roles, usuarios demo)
pnpm db:seed

# 6. Correr en desarrollo
pnpm dev
```

Abre http://localhost:3000.

**Usuarios demo** (generados por el seed):
- Director: `directora@cmenglish.test` / `Demo2026!`
- Coordinador: `coordinacion@cmenglish.test` / `Demo2026!`
- Docente: `docente@cmenglish.test` / `Demo2026!`
- Estudiante: `estudiante@cmenglish.test` / `Demo2026!`

## Documentación

- **`docs/data-model.md`** — modelo de datos completo con decisiones de diseño.
- **`docs/design-brief.md`** — sistema de marca, paleta, tipografía, anti-patrones.
- **`docs/decisions.md`** — Architecture Decision Records.
- **`docs/flows/`** — los 6 flujos críticos del sistema, paso a paso.
- **`docs/setup.md`** — guía detallada de setup y onboarding.
- **`docs/deployment.md`** — despliegue en Dokploy (Dockerfile + Postgres administrado + persistencia).

## Scripts principales

```bash
pnpm dev                  # Dev server con hot reload
pnpm build                # Build de producción
pnpm start                # Start de producción
pnpm lint                 # ESLint
pnpm typecheck            # TypeScript sin emitir
pnpm test                 # Vitest (unit + integration)
pnpm test:e2e             # Playwright (E2E)
pnpm prisma studio        # GUI para inspeccionar la DB
pnpm db:seed              # Popular con datos iniciales
pnpm db:reset             # Tumbar + migrar + seed (CUIDADO: pierde datos)
```

## Estructura del proyecto

Ver `docs/setup.md` para explicación detallada. Resumen:

```
src/
├── app/            Solo routing (Next.js App Router)
├── modules/        Lógica de negocio por dominio
├── components/     Componentes UI reutilizables
├── lib/            Infraestructura (prisma, auth, storage, email, date)
└── types/          Tipos compartidos
```

## Licencia

Propietario · © 2026 Carolina Monsalve
