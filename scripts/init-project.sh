#!/usr/bin/env bash
# =============================================================================
#  CM English Instructor — Bootstrap script
# -----------------------------------------------------------------------------
#  Instala deps y las skills oficiales recomendadas para Claude Code.
#  Las skills custom del dominio ya viven en .claude/skills/ y se descubren
#  automáticamente al abrir el repo con `claude`.
#
#  Uso recomendado:  ./scripts/init-project.sh
#  (con ejecutable directo; la shebang hereda el PATH de tu shell)
#
#  Si preferís `bash scripts/init-project.sh`, es posible que tu version
#  manager de Node — fnm, nvm, volta, asdf — no exponga `node` en el subshell.
#  En ese caso el script intenta cargarlo; si falla, te da pasos manuales.
# =============================================================================

set -uo pipefail

cyan()  { printf "\033[0;36m%s\033[0m\n" "$1"; }
green() { printf "\033[0;32m✓ %s\033[0m\n" "$1"; }
red()   { printf "\033[0;31m✗ %s\033[0m\n" "$1"; }
warn()  { printf "\033[0;33m⚠ %s\033[0m\n" "$1"; }
dim()   { printf "\033[0;90m%s\033[0m\n" "$1"; }

cyan "==> Verificando dependencias..."

# ----------------------------------------------------------------------------
# Detección robusta de Node.js
# Intenta primero PATH directo; si falla, intenta cargar version managers
# comunes (fnm, nvm, volta, asdf). Esto soluciona el caso de correr el script
# con `bash script.sh` donde el subshell no hereda el init del manager.
# ----------------------------------------------------------------------------
find_node() {
  if command -v node >/dev/null 2>&1; then return 0; fi

  # fnm
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env --use-on-cd 2>/dev/null)" || true
    command -v node >/dev/null 2>&1 && return 0
  fi

  # nvm (script-loaded, no binario)
  if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    command -v node >/dev/null 2>&1 && return 0
  fi

  # volta
  if [ -x "$HOME/.volta/bin/node" ]; then
    export PATH="$HOME/.volta/bin:$PATH"
    command -v node >/dev/null 2>&1 && return 0
  fi

  # asdf
  if [ -s "$HOME/.asdf/asdf.sh" ]; then
    # shellcheck disable=SC1090
    . "$HOME/.asdf/asdf.sh"
    command -v node >/dev/null 2>&1 && return 0
  fi

  return 1
}

if ! find_node; then
  red "Node.js no encontrado en el PATH de este subshell."
  echo ""
  dim "Tu shell principal probablemente sí lo tiene — corré 'node -v' afuera para confirmar."
  dim "Esto pasa seguido con fnm, nvm, volta: sus shims no se cargan en subshells no-interactivos."
  echo ""
  cyan "Opciones:"
  echo "  1) Ejecutar el script con la shebang en lugar de con 'bash':"
  echo "       ./scripts/init-project.sh"
  echo ""
  echo "  2) Hacer los pasos manualmente desde tu shell principal:"
  echo "       pnpm install"
  echo "       npx skills add anthropics/skills/frontend-design"
  echo "       npx skills add vercel-labs/agent-skills/web-design-guidelines"
  echo "       npx skills add vercel-labs/agent-skills/react-best-practices"
  echo "       npx skills add vercel-labs/agent-skills/next-best-practices"
  echo "       npx skills add vercel-labs/agent-skills/composition-patterns"
  echo ""
  exit 1
fi

green "Node.js $(node -v)"

# ----------------------------------------------------------------------------
# pnpm — instalar via corepack si no está
# ----------------------------------------------------------------------------
if ! command -v pnpm >/dev/null 2>&1; then
  warn "pnpm no encontrado. Instalando vía corepack..."
  if command -v corepack >/dev/null 2>&1; then
    corepack enable 2>/dev/null || true
    corepack prepare pnpm@latest --activate || {
      red "No se pudo activar pnpm. Instalalo manualmente: npm install -g pnpm"
      exit 1
    }
  else
    red "corepack tampoco está disponible. Instalá pnpm manualmente: npm install -g pnpm"
    exit 1
  fi
fi
green "pnpm $(pnpm -v)"

# ----------------------------------------------------------------------------
# Dependencias del proyecto
# ----------------------------------------------------------------------------
cyan ""
cyan "==> Instalando dependencias del proyecto..."
pnpm install

# ----------------------------------------------------------------------------
# Skills oficiales para Claude Code
# ----------------------------------------------------------------------------
cyan ""
cyan "==> Instalando skills oficiales recomendadas para Claude Code..."

SKILLS=(
  "anthropics/skills/frontend-design"
  "vercel-labs/agent-skills/web-design-guidelines"
  "vercel-labs/agent-skills/react-best-practices"
  "vercel-labs/agent-skills/next-best-practices"
  "vercel-labs/agent-skills/composition-patterns"
)

FAILED_SKILLS=()
for skill in "${SKILLS[@]}"; do
  echo ""
  cyan "  → $skill"
  if npx --yes skills add "$skill" 2>&1; then
    green "    instalada"
  else
    warn "    no se pudo instalar"
    FAILED_SKILLS+=("$skill")
  fi
done

if [ ${#FAILED_SKILLS[@]} -gt 0 ]; then
  echo ""
  warn "Algunas skills no se instalaron (posible: Claude Code no inicializado todavía)."
  dim "Podés reintentar después con:"
  for s in "${FAILED_SKILLS[@]}"; do
    dim "  npx skills add $s"
  done
fi

# ----------------------------------------------------------------------------
# Listado de skills custom del repo
# ----------------------------------------------------------------------------
echo ""
cyan "==> Skills custom del dominio (ya en el repo):"
if [ -d .claude/skills ]; then
  ls -1 .claude/skills/ | while read -r skill; do
    green "$skill"
  done
else
  warn "Carpeta .claude/skills no encontrada — ¿estás en la raíz del repo?"
fi

# ----------------------------------------------------------------------------
# Next steps
# ----------------------------------------------------------------------------
echo ""
green "Setup completo."
echo ""
cyan "Próximos pasos:"
echo "  1. cp .env.example .env   (y completar valores — ver docs/setup.md)"
echo "  2. Levantar Postgres (local o Docker)"
echo "  3. pnpm prisma migrate dev --name init"
echo "  4. pnpm db:seed"
echo "  5. pnpm dev"
echo "  6. claude  (para arrancar Claude Code en este repo)"
echo ""
fi
green "Node.js $(node -v)"

if ! command -v pnpm >/dev/null 2>&1; then
  warn "pnpm no encontrado. Instalando con corepack..."
  corepack enable
  corepack prepare pnpm@latest --activate
fi
green "pnpm $(pnpm -v)"

if ! command -v npx >/dev/null 2>&1; then
  red "npx no encontrado (debería venir con Node)."
  exit 1
fi

cyan "==> Instalando dependencias del proyecto..."
pnpm install

cyan "==> Instalando skills oficiales recomendadas para Claude Code..."

SKILLS=(
  "anthropics/skills/frontend-design"
  "vercel-labs/agent-skills/web-design-guidelines"
  "vercel-labs/agent-skills/react-best-practices"
  "vercel-labs/agent-skills/next-best-practices"
  "vercel-labs/agent-skills/composition-patterns"
)

for skill in "${SKILLS[@]}"; do
  echo ""
  cyan "  → $skill"
  if npx --yes skills add "$skill" 2>&1; then
    green "    instalada"
  else
    warn "    no se pudo instalar (¿estás en un proyecto con Claude Code inicializado?)"
    warn "    podés instalarla manualmente más tarde con: npx skills add $skill"
  fi
done

echo ""
cyan "==> Skills custom del dominio (ya en el repo)..."
ls -1 .claude/skills/ | while read -r skill; do
  green "$skill"
done

echo ""
green "Setup completo."
echo ""
cyan "Próximos pasos:"
echo "  1. Copiar .env.example a .env y completar valores"
echo "  2. Levantar Postgres (local o Docker)"
echo "  3. pnpm prisma migrate dev --name init"
echo "  4. pnpm db:seed"
echo "  5. pnpm dev"
echo "  6. claude (para arrancar Claude Code en este repo)"
echo ""
