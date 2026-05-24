# syntax=docker/dockerfile:1.7
# Build context is the monorepo root (CI: context=.). Paths are repo-relative.

# --- builder ---
FROM golang:1.23.4-alpine3.20 AS builder
WORKDIR /src

RUN apk add --no-cache git ca-certificates

# Pre-fetch modules for cache reuse.
COPY apps/api/go.mod apps/api/go.sum ./apps/api/
WORKDIR /src/apps/api
RUN go mod download

# Copy api sources.
WORKDIR /src
COPY apps/api ./apps/api

WORKDIR /src/apps/api
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed

# --- runtime ---
FROM alpine:3.23
RUN apk add --no-cache ca-certificates tzdata wget && \
    addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --from=builder /out/api /usr/local/bin/api
COPY --from=builder /out/seed /usr/local/bin/seed
COPY --from=builder /src/apps/api/migrations ./migrations

USER app
EXPOSE 8080
ENV HTTP_ADDR=:8080
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["/usr/local/bin/api"]
