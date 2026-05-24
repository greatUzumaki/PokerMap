# syntax=docker/dockerfile:1.7
# PokerMap admin app — Next.js with standalone output, basePath /poker/admin in prod.

ARG NODE_VERSION=24.1.0
ARG ALPINE_VERSION=3.20

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /repo

ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json

RUN pnpm install --frozen-lockfile --filter admin... --filter "@pokermap/*"

COPY . .

ARG BASE_PATH=""
ARG NEXT_PUBLIC_API_URL="http://localhost:8080"
ARG NEXT_PUBLIC_BASE_PATH=""
ARG NEXT_PUBLIC_MAP_TILE_URL=""
ARG NEXT_PUBLIC_MAP_ATTRIBUTION=""
ARG NEXT_PUBLIC_APP_NAME=""
ARG MINIO_PUBLIC_URL=""
ENV BASE_PATH=$BASE_PATH \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH \
    NEXT_PUBLIC_MAP_TILE_URL=$NEXT_PUBLIC_MAP_TILE_URL \
    NEXT_PUBLIC_MAP_ATTRIBUTION=$NEXT_PUBLIC_MAP_ATTRIBUTION \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    MINIO_PUBLIC_URL=$MINIO_PUBLIC_URL

WORKDIR /repo/apps/admin
RUN pnpm run build

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner
RUN apk add --no-cache libc6-compat tini wget && \
    addgroup -S app && adduser -S -G app -u 1001 app
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=app:app /repo/apps/admin/.next/standalone ./
COPY --from=builder --chown=app:app /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=app:app /repo/apps/admin/public ./apps/admin/public

ARG BASE_PATH=""
ENV BASE_PATH=$BASE_PATH

USER app
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:3001${BASE_PATH:-/}" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/admin/server.js"]
