# Guía de setup — CM English Instructor

> Guía para que un humano (o un agente de Claude Code) pueda clonar el repo y
> dejar el proyecto corriendo localmente. También incluye los pasos para
> instalar las skills oficiales de Claude Code recomendadas.

---

## Pre-requisitos

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (recomendado sobre npm/yarn por velocidad y estricta resolución)
- **PostgreSQL** ≥ 14 corriendo localmente (o un Postgres en cloud: Neon, Supabase)
- **Claude Code** instalado: `curl -fsSL https://claude.ai/install.sh | sh` (o ver docs.claude.com)
- (Opcional) **Docker + Docker Compose** si prefieres no instalar Postgres nativo

---

## Setup paso a paso

### 1. Clonar e instalar

```bash
git clone <tu-repo> cm-english-instructor
cd cm-english-instructor

pnpm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con valores locales. Mínimo a configurar:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cm_english"
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Opcionales para empezar (puedes dejar valores default):
- `EMAIL_PROVIDER=console` (no envía mails reales en dev)
- `STORAGE_DRIVER=local` (guarda archivos en `./storage`)

### 3. Base de datos

**Opción A — Postgres local nativo:**

```bash
createdb cm_english
```

**Opción B — Postgres en Docker:**

Crear `docker-compose.yml` en la raíz (no incluido por defecto):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: cm_english
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```

Luego: `docker compose up -d`

### 4. Migraciones y seed

```bash
pnpm prisma migrate dev --name init
pnpm db:seed
```

El seed crea:
- Catálogo académico real (Time Zones, Life, Market Leader, Specialization, Kids, Vistas).
- Niveles CEFR para inglés y español.
- 4 usuarios demo (uno por rol) con password `Demo2026!`.
- AppSettings iniciales.
- Feriados Ecuador 2026.
- Banco de preguntas de ejemplo.

### 5. Correr en dev

```bash
pnpm dev
```

Abre http://localhost:3000.

Logins demo:
- `directora@cmenglish.test` / `Demo2026!`
- `coordinacion@cmenglish.test` / `Demo2026!`
- `docente@cmenglish.test` / `Demo2026!`
- `estudiante@cmenglish.test` / `Demo2026!`

---

## Setup de Claude Code

### 1. Instalar skills oficiales recomendadas

Dentro del repo, ejecutar:

```bash
bash scripts/init-project.sh
```

Esto instala las siguientes skills oficiales (en orden de prioridad):

**Nivel 1 — Base (obligatorias)**:
- `anthropics/skills/frontend-design` — principios de diseño visual
- `vercel-labs/agent-skills/web-design-guidelines` — guidelines de UI web
- `vercel-labs/agent-skills/react-best-practices` — patrones React
- `vercel-labs/agent-skills/next-best-practices` — patrones Next.js App Router
- `vercel-labs/agent-skills/composition-patterns` — composición de componentes

Si prefieres instalarlas manualmente:

```bash
npx skills add anthropics/skills/frontend-design
npx skills add vercel-labs/agent-skills/web-design-guidelines
npx skills add vercel-labs/agent-skills/react-best-practices
npx skills add vercel-labs/agent-skills/next-best-practices
npx skills add vercel-labs/agent-skills/composition-patterns
```

### 2. Skills custom del dominio (ya incluidas en el repo)

Estas viven en `.claude/skills/` y son específicas de este proyecto. Claude Code las descubre automáticamente al abrir el repo:

- `prisma-schema-conventions/` — cómo evolucionar el schema sin romper convenciones.
- `nextjs-app-conventions/` — dónde va cada cosa en App Router de este proyecto.
- `language-school-domain/` — vocabulario y reglas del dominio (matrículas, sesiones, niveles).
- `email-notifications/` — patrón de cola de notificaciones.
- `test-engine-rules/` — reglas estrictas del motor de exámenes.

### 3. Iniciar Claude Code

```bash
claude
```

Pídele algo como:

```
Lee CLAUDE.md y los archivos en docs/. Luego implementa el módulo de
postulación de docentes siguiendo docs/flows/01-teacher-onboarding.md.
```

Claude Code leerá el contexto, descubrirá las skills custom, y trabajará
respetando las convenciones documentadas.

---

## Estructura del proyecto

```
cm-english-instructor/
├── CLAUDE.md                  ← contexto principal para Claude Code
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── .env.example
├── .gitignore
│
├── .claude/
│   └── skills/                ← skills custom del dominio
│       ├── prisma-schema-conventions/
│       ├── nextjs-app-conventions/
│       ├── language-school-domain/
│       ├── email-notifications/
│       └── test-engine-rules/
│
├── .github/
│   └── workflows/
│       └── ci.yml             ← typecheck + lint + test + prisma validate
│
├── prisma/
│   ├── schema.prisma          ← fuente de verdad del modelo
│   ├── seed.ts                ← catálogo + usuarios demo
│   └── migrations/
│
├── docs/
│   ├── data-model.md          ← documentación del modelo
│   ├── design-brief.md        ← sistema de marca y diseño
│   ├── decisions.md           ← Architecture Decision Records
│   ├── setup.md               ← este archivo
│   └── flows/
│       ├── 01-teacher-onboarding.md
│       ├── 02-student-enrollment.md
│       ├── 03-test-session.md
│       ├── 04-teacher-assignment.md
│       ├── 05-class-session.md
│       └── 06-payroll.md
│
├── public/
│   └── brand/
│       ├── ico_white.svg
│       ├── ico_black.svg
│       └── ico_color.svg
│
├── scripts/
│   └── init-project.sh        ← instala skills oficiales de Claude Code
│
├── emails/                    ← templates de react-email
│   └── _components/
│
├── tests/
│   ├── e2e/                   ← Playwright
│   └── fixtures/
│
└── src/
    ├── app/                   ← solo routing (Next.js App Router)
    │   ├── (public)/
    │   ├── (admin)/
    │   ├── (teacher)/
    │   ├── (student)/
    │   ├── api/               ← solo webhooks, cron, exam endpoints
    │   └── globals.css
    │
    ├── modules/               ← lógica de negocio por dominio
    │   ├── auth/
    │   ├── catalog/
    │   ├── teachers/
    │   ├── students/
    │   ├── enrollments/
    │   ├── tests/             ← motor de exámenes (delicado, ver flow 03)
    │   ├── scheduling/
    │   ├── classes/
    │   ├── payroll/
    │   ├── materials/
    │   ├── notifications/
    │   ├── settings/
    │   └── audit/
    │
    ├── components/            ← UI reutilizable
    │   ├── ui/                ← shadcn primitives
    │   ├── forms/
    │   ├── calendar/
    │   ├── test-engine/
    │   ├── tables/
    │   └── layout/
    │
    ├── lib/                   ← infraestructura
    │   ├── prisma.ts
    │   ├── auth.ts
    │   ├── env.ts
    │   ├── storage/           ← StorageAdapter abstracto
    │   ├── email/             ← EmailProvider abstracto
    │   └── date/
    │
    └── types/
```

### Cada módulo de `src/modules/` sigue el patrón:

```
modules/teachers/
├── applications/
│   ├── schemas.ts             ← Zod schemas
│   ├── queries.ts             ← lecturas Prisma
│   ├── submit.action.ts       ← Server Action: postular
│   ├── approve.action.ts      ← Server Action: aprobar
│   ├── reject.action.ts       ← Server Action: rechazar
│   └── __tests__/
│       └── *.test.ts
└── profiles/
    └── ...
```

---

## Comandos útiles

```bash
pnpm dev                  # dev server con turbo
pnpm build                # build producción
pnpm start                # start producción local
pnpm lint                 # ESLint
pnpm typecheck            # tsc --noEmit
pnpm format               # prettier --write

pnpm test                 # vitest (unit + integration)
pnpm test:watch
pnpm test:e2e             # playwright
pnpm test:e2e:ui          # playwright modo UI

pnpm prisma studio        # GUI para inspeccionar la DB
pnpm db:migrate           # crear migración a partir de cambios en schema
pnpm db:deploy            # aplicar migraciones existentes (en CI / prod)
pnpm db:seed              # popular con datos iniciales
pnpm db:reset             # ⚠️ tumbar y volver a crear (perderás datos locales)

pnpm email:dev            # preview de templates de email en localhost:3030
```

---

## Troubleshooting

**`Error: P1001: Can't reach database server`**  
Postgres no está corriendo. Levanta el servicio o `docker compose up -d`.

**`Error: Environment variable not found: AUTH_SECRET`**  
Falta llenar `.env`. Genera con `openssl rand -base64 32`.

**`pnpm install` falla con peer-deps**  
React 19 todavía es relativamente nuevo. Si una librería no soporta peer, usar `pnpm install --shamefully-hoist` solo si es necesario, y registrar el caso para revisión.

**Hot reload muy lento**  
Verifica que `next.config.ts` tenga `experimental.turbo` y que estés corriendo `pnpm dev` (no `next dev` directo sin turbo).

**Playwright no encuentra el browser**  
Primera vez: `pnpm exec playwright install chromium`.

---

## Próximos pasos (orden sugerido para Claude Code)

Una vez todo funcionando, el orden recomendado de implementación es:

1. **Auth + login** (módulo `auth`, route `/login`).
2. **Layout base** con sidebar/topbar en ink, área de trabajo en bone.
3. **Dashboard según rol**.
4. **Postulación de docentes** (flow 01).
5. **Banco de preguntas + plantillas** (parte del flow 03).
6. **Motor de exámenes** (flow 03).
7. **Inscripción de estudiantes** (flow 02).
8. **Asignación de docente** (flow 04).
9. **Sesiones de clase con bitácora** (flow 05).
10. **Facturación** (flow 06).
11. **Notificaciones por email** (cola + cron).
12. **Repositorio de materiales**.
13. **Panel de configuración** (AppSetting).

Cada módulo debe completarse en vertical: schema → migration → actions → queries → UI → tests, en ese orden.
