# Carga inicial de materiales (~131 GB)

Runbook para la **carga inicial** del contenido de cursos al repositorio de materiales. Es un proceso **one-shot**: después de esto, todo material nuevo se sube manualmente desde la app.

Hay dos herramientas:

- **Cliente remoto por HTTP (recomendado — Dokploy sin SSH):** `scripts/import-materials-remote.ts`. Corre en la máquina que tiene el drive, apunta a la **URL de producción**, se autentica como DIRECTOR y sube todo por los endpoints de la app. **No requiere SSH, ni cambios de Dockerfile, ni acceso al servidor.**
- **Importador local a disco (alternativa / dev):** `scripts/import-materials.ts`. Corre en el mismo host que el storage y escribe directo a disco + BD. Requiere acceso al servidor (ver la sección final).

Ambos comparten el mapeo carpeta→nivel (`scripts/lib/materials-mapping.ts`).

## Qué carga y cómo lo organiza

- Mapea cada carpeta del drive (`E:\CONTENIDO PLATAFORMA`) a un `ProgramLevel`:
  - Market Leader → `Elementary … Advanced`
  - Specialization → `Emailing`, `Meetings`, … (9 módulos)
  - Life / Perspectives / Time Zones → `NIVEL n` → nivel `n`
  - Kids Learning → nivel `Integral` (con `Kids Reading/` y `Kids Writing/` como subcarpetas)
- Replica el subárbol completo de cada nivel (`INSTALL/`, `PDF/`, `AUDIOS/`, …).
- **Se omiten**: `PAGINA WEB/` (plantillas operativas) y Vistas/Español (sin contenido en el drive). Descarta basura de SO (`__MACOSX`, `.DS_Store`, `._*`, `Thumbs.db`).
- **Incluye los instaladores** (`INSTALL/`, ~131 GB). El volumen de storage necesita **≥ ~140 GB libres**.

## Requisitos previos

1. Catálogo y super admin ya sembrados — en Dokploy esto ocurre **solo en cada arranque** (`docker-entrypoint.sh` → `seed.production.ts`). No hay paso manual.
2. Credenciales de un usuario **DIRECTOR** activo.
3. `STORAGE_DRIVER=local` en la app (ya es el default en producción).

---

## Vía recomendada: cliente remoto por HTTP

Se ejecuta desde **tu máquina con el drive**, no en el servidor. Reutiliza los endpoints de la app (`/api/materials/ensure-folder`, `/api/materials/upload`) y el proxy de Dokploy (Traefik, sin tope de body).

### 1. Dry-run (no sube nada; valida auth y mapeo)

```bash
pnpm materials:import:remote -- \
  --base-url https://app.cmenglishinstructor.com \
  --source "E:/CONTENIDO PLATAFORMA" \
  --email directora@cmenglishinstructor.com --password '••••••' \
  --dry-run
```

Revisar que autentique (`✓ Autenticado como …`), que cada carpeta resuelva a su nivel (`→ nivel …`) y que **no haya** `NO MAPEADO`.

### 2. Carga real

Mismo comando sin `--dry-run`. Las credenciales pueden ir por env en vez de flags: `IMPORT_EMAIL`, `IMPORT_PASSWORD` (y `IMPORT_BASE_URL`).

```bash
pnpm materials:import:remote -- \
  --base-url https://app.cmenglishinstructor.com \
  --source "E:/CONTENIDO PLATAFORMA" \
  --email directora@cmenglishinstructor.com --password '••••••' \
  --concurrency 4
```

Flags: `--only "<texto>"` (limita a programas cuyo nombre contenga el texto, útil por tandas), `--concurrency <n>` (subidas en paralelo, default 4).

### Consideraciones

- **Ancho de banda:** los ~131 GB viajan por el uplink de tu máquina; puede tardar horas/días. Conviene correrlo desde un lugar con buena subida y dejar el proceso corriendo.
- **Reanudable:** si un archivo ya existe, el endpoint de subida responde **409** y el cliente lo cuenta como _saltado_. Si el proceso se corta, **volver a correr el mismo comando** retoma donde quedó (re-login automático ante expiración de sesión).
- **Login sin captcha:** usa el flujo de credenciales de Auth.js; requiere un DIRECTOR `ACTIVE`.

---

## Verificación post-carga

1. El resumen imprime `Archivos subidos`, `Saltados (409)`, `Errores` y `Total transferido`. **Errores debe ser 0.**
2. Re-correr → debe reportar **todo saltado** (0 subidos).
3. En la app, como DIRECTOR → **Materiales**: cada nivel muestra sus carpetas; abrir un PDF y confirmar que descarga/abre.

---

## Alternativa: importador local a disco (requiere acceso al servidor)

Si en el futuro hay acceso al host/volumen, `scripts/import-materials.ts` es más rápido (escribe directo a disco, sin HTTP):

```bash
# en el servidor, con LOCAL_STORAGE_PATH apuntando al storage real
pnpm materials:import -- --source "/ruta/CONTENIDO PLATAFORMA" --dry-run
pnpm materials:import -- --source "/ruta/CONTENIDO PLATAFORMA"
```

En Dokploy esto exige que el script viaje en la imagen (hoy el stage `runner` del `Dockerfile` no copia `scripts/`) y correrlo vía la Terminal del panel sobre un bind-mount del contenido — por eso la **vía recomendada es el cliente remoto**, que no necesita nada de eso.

## Notas

- No re-ejecutar como parte del deploy: es manual y one-shot.
- Para el límite de subida manual desde la app (proxy), ver "Subida de archivos grandes" en [`docs/deployment.md`](../deployment.md).
