# syntax=docker/dockerfile:1.7
# Single Next.js image — serves both the public Mini App and the /admin segment.
# (Admin is a route segment, not a separate app. If you want a fully-separate
# admin frontend later, fork this file to apps/admin/ and split routes.)

ARG NODE_VERSION=24.1.0
ARG ALPINE_VERSION=3.20

# --- builder ---
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /repo

# Enable pnpm via corepack and pin version.
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy workspace manifests first for cache reuse.
COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json

RUN pnpm install --frozen-lockfile --filter web... --filter "@pokermap/*"

# Now copy sources.
COPY . .

WORKDIR /repo/apps/web
RUN pnpm run build

# --- runner ---
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner
RUN apk add --no-cache libc6-compat tini && \
    addgroup -S app && adduser -S -G app -u 1001 app
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy the standalone Next.js output. Requires `output: "standalone"` in next.config.ts.
# Without standalone we copy the full app — heavier but works.
COPY --from=builder --chown=app:app /repo/apps/web/.next ./.next
COPY --from=builder --chown=app:app /repo/apps/web/public ./public
COPY --from=builder --chown=app:app /repo/apps/web/package.json ./package.json
COPY --from=builder --chown=app:app /repo/node_modules ./node_modules
COPY --from=builder --chown=app:app /repo/packages ./packages

USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node_modules/next/dist/bin/next", "start"]
