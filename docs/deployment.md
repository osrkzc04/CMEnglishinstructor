# Deployment — Dokploy

Guía de despliegue para CM English Instructor en Dokploy. Cubre:

- Variables de entorno requeridas
- Cómo Dokploy levanta la aplicación
- Persistencia (volúmenes, datos sembrados)
- Rollback y troubleshooting

---

## Visión general

**Arquitectura:** la app y la base de datos son **dos recursos separados** dentro de Dokploy. La app se despliega desde el `Dockerfile`; la DB es un recurso de tipo "PostgreSQL" que Dokploy gestiona aparte (con backups automáticos, restore desde UI, etc.). La app se conecta a la DB vía la `DATABASE_URL` que Dokploy genera.

La imagen Docker corre tres cosas en cada arranque del contenedor:

1. `prisma migrate deploy` — aplica migraciones pendientes.
2. `prisma/seed.production.ts` — siembra catálogo, settings, feriados y super admin (idempotente; no toca lo que ya exista).
3. `next start` — sirve la app en `:3000`.

El usuario `DIRECTOR` se crea en la primera corrida tomando `SUPER_ADMIN_*` del entorno. En arranques posteriores el `upsert` lo deja intacto.

> El archivo `docker-compose.yml` del repo **NO se usa en Dokploy**. Existe solo para probar el Dockerfile en tu máquina (levanta `app` + un Postgres local). En Dokploy la DB siempre viene del recurso "Database" del paso 1.

---

## Variables de entorno

### Obligatorias

| Variable | Ejemplo | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db?sslmode=require` | Postgres 15+. Si usás la DB administrada de Dokploy, copia la URL desde su panel. |
| `AUTH_URL` | `https://app.cmenglishinstructor.com` | URL pública sin trailing slash. Usada por Auth.js para callbacks. |
| `AUTH_SECRET` | (hex 32 bytes) | `openssl rand -base64 32`. Mantenelo secreto, rotar implica relogin de todos. |
| `NEXT_PUBLIC_APP_URL` | `https://app.cmenglishinstructor.com` | URL pública usada en emails y links de invitación. |
| `SUPER_ADMIN_EMAIL` | `directora@cmenglishinstructor.com` | Email del director inicial. |
| `SUPER_ADMIN_PASSWORD` | (≥ 12 caracteres, fuerte) | Hash con bcrypt al primer arranque. Cambiable después por UI. |
| `CRON_SECRET` | (hex 32 bytes) | `openssl rand -hex 32`. Protege `/api/cron/*`. |

### Opcionales del super admin

`SUPER_ADMIN_FIRST_NAME`, `SUPER_ADMIN_LAST_NAME`, `SUPER_ADMIN_DOCUMENT`, `SUPER_ADMIN_PHONE`. Si no se setean, los nombres default son "Director" y "Principal".

### Email (recomendado para producción)

```
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.cmenglishinstructor.com
SMTP_PORT=587
SMTP_USER=notificaciones@cmenglishinstructor.com
SMTP_PASSWORD=(secret)
SMTP_SECURE=false
EMAIL_FROM="CM English Instructor <notificaciones@cmenglishinstructor.com>"
EMAIL_REPLY_TO=coordinacion@cmenglishinstructor.com
```

Si dejás `EMAIL_PROVIDER=console`, los emails salen por log y no se entregan — útil para staging.

### Storage

```
STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=/app/storage
```

`/app/storage` está definido como `VOLUME` en el Dockerfile. Dokploy lo persiste automáticamente como volumen nombrado. Para migrar a Cloudflare R2 más adelante, cambiar el driver no requiere mover datos en este punto (todavía no se sube nada en producción).

### Captcha (opcional)

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
```

Si quedan vacías, los forms públicos solo usan rate-limit por IP.

---

## Pasos en Dokploy

Arquitectura: la **app** y la **base de datos** son dos recursos separados de Dokploy. Esto permite que la DB tenga lifecycle propio (backups automáticos, restore, no se borra al re-deployar la app).

### 1. Crear la base de datos

En Dokploy → "Databases" → "Create" → "PostgreSQL".

- **Image**: `postgres:16` o más reciente.
- **Database name**: `cmenglish` (o el que prefieras).
- **User**: `cmuser`.
- **Password**: generar uno fuerte y guardarlo.
- **External port**: dejar en blanco (no exponer fuera de la red interna de Dokploy).

Al crear, Dokploy muestra la **Connection URL interna** (`postgres://cmuser:...@<id>:5432/cmenglish`). Esta es la `DATABASE_URL` que va a la app.

> Backups: en la pestaña "Backups" del recurso de DB, activá el schedule diario o el que prefieras. Dokploy maneja la rotación.

### 2. Crear la aplicación

En Dokploy → "Applications" → "Create" → "Application".

- **Source**: Git (este repositorio en la rama `main`).
- **Build type**: Dockerfile (Dokploy detecta el `Dockerfile` en la raíz automáticamente).
- **Branch**: `main`.

### 3. Variables de entorno

En el panel de la aplicación → "Environment Variables", pegar las obligatorias listadas arriba. Para `DATABASE_URL` usá la connection URL del paso 1. Para `AUTH_SECRET` y `CRON_SECRET` generá distintos:

```
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 32      # CRON_SECRET
```

### 4. Volumen para storage

En la app → "Volumes" agregá:

- **Container path**: `/app/storage`
- **Mount type**: Volume (named)
- **Name**: `cm-storage` (o el que prefieras)

Esto persiste CVs de postulantes, materiales y avatares entre re-deploys.

### 5. Dominio + SSL

- Agregá el dominio (ej. `app.cmenglishinstructor.com`).
- Habilitá "Generate SSL" (Let's Encrypt automático).

### 6. Deploy

Click en "Deploy". El primer build toma ~3-5 minutos (descarga node:20-alpine, instala dependencias, compila Next).

En los logs del primer arranque deberías ver:

```
→ [1/3] Aplicando migraciones de Prisma...
→ [2/3] Sembrando catálogo + super admin (idempotente)...
  ✓ Catálogo + CEFR
  ✓ Super admin (directora@cmenglishinstructor.com)
  ✓ Configuración global
  ✓ Feriados
✅ Seed de producción completo
→ [3/3] Iniciando Next.js en :3000 ...
   ▲ Next.js 15.x.x
   - Local:        http://0.0.0.0:3000
```

### 7. Verificación

- Healthcheck: `GET https://app.cmenglishinstructor.com/api/health` → `{ ok: true, db: "up" }`.
- Login con `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`.
- Confirmá en `/admin/configuracion` que los settings cargaron.
- Confirmá en el wizard de aula que el catálogo (cursos / programas / niveles) está poblado.

---

## Persistencia y datos sembrados

El seed de producción **solo siembra lo esencial** (no datos demo). Es idempotente:

| Bloque | Idempotencia | Modificable por UI |
|---|---|---|
| Idiomas (`Language`) | `upsert` por `code` | No (catálogo cerrado: EN/ES) |
| Niveles CEFR (`CefrLevel`) | `upsert` por `(languageId, code)` | No |
| Catálogo (`Course/Program/ProgramLevel`) | `count > 0` salta todo | Sí, vía `/admin/cursos` |
| Configuración (`AppSetting`) | `upsert` por `key`, **no** sobreescribe valores | Sí, vía `/admin/configuracion` |
| Feriados (`Holiday`) | `upsert` por `(date, name)` | Sí, vía UI futura |
| Super admin | `upsert` por `email`, **no** sobreescribe pass | Sí, vía UI de perfil |

**Implicaciones operativas:**

- Si cambiás `SUPER_ADMIN_PASSWORD` en el panel de Dokploy y redeployás, **la contraseña no se actualiza** en la DB — el seed deja al usuario existente intacto. Para cambiar pass tras el primer login se usa la UI. Para emergencias, podés correr manualmente:
  ```
  docker exec -it <container> sh
  ./node_modules/.bin/tsx -e "
    import('@prisma/client').then(async ({ PrismaClient }) => {
      const { hash } = await import('bcryptjs')
      const p = new PrismaClient()
      await p.user.update({ where: { email: 'YOUR_EMAIL' }, data: { passwordHash: await hash('NEW_PASS', 10) } })
      console.log('OK')
      await p.\$disconnect()
    })
  "
  ```
- Si querés ampliar el catálogo (nuevo curso o programa), hacelo desde la UI. El seed no lo va a tocar.
- Los settings sembrados son los valores **por defecto**. Si un coordinator los modifica vía UI, el redeploy mantiene los modificados.

---

## Rollback

Dokploy mantiene historial de deploys. Para volver a la versión previa:

1. Panel de la aplicación → "Deployments" → seleccionar el deploy anterior → "Redeploy".

Sobre la base de datos:

- Las migraciones son **forward-only**. Si una migración nueva falla, Prisma deja el estado anterior intacto.
- Si una migración pasó pero rompió el código, redeployando la versión previa la app vuelve a funcionar **siempre que la migración sea backward-compatible** (lo son por convención: agregar columnas, agregar tablas, agregar índices). Las migraciones destructivas (drop column, rename) requieren una segunda migración para rollback.

---

## Troubleshooting

### `SUPER_ADMIN_EMAIL` falta y el contenedor reinicia

El seed de producción **falla rápido** si faltan las credenciales del admin. Mensaje:

```
Faltan SUPER_ADMIN_EMAIL y/o SUPER_ADMIN_PASSWORD. Definilos en el entorno antes de correr el seed de producción.
```

Solución: definir ambas variables en Dokploy y redeploy.

### `prisma migrate deploy` falla

Causas típicas:

- `DATABASE_URL` apunta a una DB diferente a la usada en dev (¡revisar el host!).
- Una migración previa quedó "in progress". Limpiar con `npx prisma migrate resolve --applied <migration_name>` desde la consola del contenedor.

### El healthcheck devuelve 503 (`db: down`)

La app arrancó pero no puede hablar con Postgres. Revisar:

- Networking entre `app` y `db` (en compose es por nombre de servicio).
- Credenciales del `DATABASE_URL` (incluyendo `?sslmode=require` si la DB lo exige).

### Materiales subidos desaparecen tras un redeploy

El volumen `/app/storage` no quedó configurado como persistente. En Dokploy: "Volumes" → agregar como Named Volume.

---

## Migrar de Neon a Postgres administrado por Dokploy (o viceversa)

1. Backup: `pg_dump $OLD_DATABASE_URL > backup.sql`
2. Crear la nueva DB en Dokploy / Neon.
3. Restore: `psql $NEW_DATABASE_URL < backup.sql`
4. Actualizar `DATABASE_URL` en Dokploy → redeploy.

El seed de producción no rompe en la nueva DB: detecta que el catálogo / super admin ya existen vía `upsert` con `update: {}`.

---

## Cron jobs

La app trae un scheduler **in-process** (`src/instrumentation.ts`) que dispara:

- Retry de emails fallidos — cada 15 min
- Materialización de sesiones — cada 7 días + corrida al arranque
- Auto-cierre de sesiones sin registro — cada 5 min

Estos no requieren configuración externa en Dokploy. Si más adelante escalan a múltiples instancias, mover a un worker dedicado o a cron del SO para evitar duplicación.

Como respaldo, los endpoints `/api/cron/*` siguen disponibles con `Authorization: Bearer $CRON_SECRET` para invocación externa (Vercel Cron, cron del host, monitoreo).
