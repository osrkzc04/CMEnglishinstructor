#!/bin/sh
# =============================================================================
# Entrypoint del contenedor para Dokploy.
# -----------------------------------------------------------------------------
# Secuencia en cada arranque:
#   1) Aplica migraciones pendientes (`prisma migrate deploy`).
#   2) Corre el seed de producción (`prisma/seed.production.ts`) — idempotente:
#      verifica catálogo, settings, holidays y super admin. Si todo existe, los
#      saltea sin tocar nada.
#   3) Arranca Next.js en modo producción.
#
# Falla rápido si algo crítico no está: DATABASE_URL inválida, SUPER_ADMIN_*
# faltantes en el primer arranque, migración con error.
# =============================================================================
set -eu

echo "════════════════════════════════════════════════════════════════"
echo " CM English Instructor — boot"
echo " node:    $(node --version 2>/dev/null || echo '?')"
echo " cwd:     $(pwd)"
echo " user:    $(id -u):$(id -g)"
echo "════════════════════════════════════════════════════════════════"

REQUIRED_VARS="DATABASE_URL AUTH_SECRET AUTH_URL SUPER_ADMIN_EMAIL SUPER_ADMIN_PASSWORD"
MISSING=""
for v in $REQUIRED_VARS; do
  eval "val=\${$v:-}"
  if [ -z "$val" ]; then
    MISSING="$MISSING $v"
  fi
done
if [ -n "$MISSING" ]; then
  echo "✗ Faltan variables obligatorias:$MISSING"
  echo "  Configurálas en el panel de Dokploy antes de redeployar."
  exit 1
fi

echo "→ [1/3] Aplicando migraciones de Prisma..."
./node_modules/.bin/prisma migrate deploy

echo "→ [2/3] Sembrando catálogo + super admin (idempotente)..."
./node_modules/.bin/tsx prisma/seed.production.ts

echo "→ [3/3] Iniciando Next.js en :${PORT:-3000} ..."
exec ./node_modules/.bin/next start -H "${HOSTNAME:-0.0.0.0}" -p "${PORT:-3000}"
