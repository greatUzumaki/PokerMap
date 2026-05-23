# syntax=docker/dockerfile:1.7
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

WORKDIR /repo/apps/admin
RUN pnpm run build

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner
RUN apk add --no-cache libc6-compat tini && \
    addgroup -S app && adduser -S -G app -u 1001 app
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=app:app /repo/apps/admin/.next ./.next
COPY --from=builder --chown=app:app /repo/apps/admin/public ./public
COPY --from=builder --chown=app:app /repo/apps/admin/package.json ./package.json
COPY --from=builder --chown=app:app /repo/node_modules ./node_modules
COPY --from=builder --chown=app:app /repo/packages ./packages

USER app
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/ || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node_modules/next/dist/bin/next", "start", "-p", "3001"]
