# =============================================================================
# CM English Instructor — Docker build
# -----------------------------------------------------------------------------
# Multi-stage diseñado para Dokploy. Tres etapas:
#   1) deps    — instala todas las dependencias (incluye dev: prisma, tsx).
#   2) builder — genera Prisma client y compila Next.js.
#   3) runner  — imagen final con el set mínimo + node_modules requerido por
#                runtime, migraciones y seed.
# =============================================================================

ARG NODE_VERSION=20.18.0
ARG PNPM_VERSION=9.12.3

# =============================================================================
# Stage 1 — Dependencies
# =============================================================================
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

# openssl y libc6-compat son requeridos por los binarios de Prisma.
RUN apk add --no-cache libc6-compat openssl

# Instalación directa de pnpm — evita el flujo de corepack que en Alpine suele
# fallar por verificación de firmas o descargas intermitentes.
RUN npm install -g pnpm@${PNPM_VERSION} && pnpm config set store-dir /root/.pnpm-store

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2 — Build
# =============================================================================
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl
RUN npm install -g pnpm@${PNPM_VERSION} && pnpm config set store-dir /root/.pnpm-store

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `src/lib/env.ts` detecta `NEXT_PHASE=phase-production-build` y usa
# defaults seguros para AUTH_SECRET / AUTH_URL / DATABASE_URL, así no hace
# falta meterlos como ENV en el Dockerfile (lo cual disparaba el warning
# "SecretsUsedInArgOrEnv" de scanners). En runtime Dokploy inyecta los
# reales y el schema vuelve a modo estricto.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm prisma generate
RUN pnpm build

# =============================================================================
# Stage 3 — Runtime
# =============================================================================
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl tini

# Runtime no necesita pnpm: el entrypoint invoca los binarios directamente
# desde `./node_modules/.bin/`.

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Crea usuario no-root para correr el server.
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# Carga del entrypoint y del build de Next. `sed` normaliza line endings —
# si el script se editó en Windows con CRLF, el shebang `#!/bin/sh\r` rompe
# en Alpine con "no such file or directory".
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint \
    && chmod +x /usr/local/bin/docker-entrypoint

COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/messages ./messages
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Volumen para storage local (CVs, materiales subidos por la UI). Mapear con
# `-v cm-storage:/app/storage` en Dokploy.
RUN mkdir -p /app/storage && chown nextjs:nodejs /app/storage
VOLUME ["/app/storage"]

USER nextjs
EXPOSE 3000

# tini como init proceso → maneja señales y zombies correctamente.
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint"]
CMD ["start"]
