# syntax=docker/dockerfile:1.7
# PokerMap web app — Next.js with standalone output.
# In production routes are mounted under BASE_PATH (e.g. /poker) via Traefik on a single host.

ARG NODE_VERSION=24.1.0
ARG ALPINE_VERSION=3.20

# --- builder ---
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /repo

ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json

RUN pnpm install --frozen-lockfile --filter web... --filter "@pokermap/*"

COPY . .

# Public env baked into the client bundle at build time. CI passes these as --build-arg.
ARG BASE_PATH=""
ARG NEXT_PUBLIC_API_URL="http://localhost:8080"
ARG NEXT_PUBLIC_BASE_PATH=""
ARG NEXT_PUBLIC_MAP_TILE_URL=""
ARG NEXT_PUBLIC_MAP_ATTRIBUTION=""
ARG NEXT_PUBLIC_DEFAULT_BBOX=""
ARG NEXT_PUBLIC_APP_NAME=""
ARG NEXT_PUBLIC_SUPPORT_TG=""
ARG MINIO_PUBLIC_URL=""
ENV BASE_PATH=$BASE_PATH \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH \
    NEXT_PUBLIC_MAP_TILE_URL=$NEXT_PUBLIC_MAP_TILE_URL \
    NEXT_PUBLIC_MAP_ATTRIBUTION=$NEXT_PUBLIC_MAP_ATTRIBUTION \
    NEXT_PUBLIC_DEFAULT_BBOX=$NEXT_PUBLIC_DEFAULT_BBOX \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_SUPPORT_TG=$NEXT_PUBLIC_SUPPORT_TG \
    MINIO_PUBLIC_URL=$MINIO_PUBLIC_URL

RUN pnpm --filter @pokermap/types run types:gen

WORKDIR /repo/apps/web
RUN pnpm run build

# --- runner ---
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner
RUN apk add --no-cache libc6-compat tini wget && \
    addgroup -S app && adduser -S -G app -u 1001 app
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Standalone output bundles a minimal node_modules + server.js
COPY --from=builder --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=app:app /repo/apps/web/public ./apps/web/public

# BASE_PATH is read by the runner for healthcheck only (the path is already baked in by Next.js).
ARG BASE_PATH=""
ENV BASE_PATH=$BASE_PATH

USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:3000${BASE_PATH:-/}" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
