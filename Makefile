.PHONY: help install web-dev api-dev dev lint typecheck test build migrate-up migrate-down migrate-new seed minio-bootstrap api-test web-test clean docker-up docker-down

DB_DSN ?= postgres://pokermap:pokermap@localhost:5432/pokermap?sslmode=disable
MIGRATIONS_DIR := apps/api/migrations
MINIO_ENDPOINT ?= localhost:9000
MINIO_ROOT_USER ?= pokermap
MINIO_ROOT_PASSWORD ?= pokermap-secret
MINIO_BUCKET ?= pokermap-photos

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies (pnpm + go mod)
	pnpm install
	cd apps/api && go mod download

web-dev: ## Run Next.js public app
	pnpm --filter web dev

admin-dev: ## Run Next.js admin app (port 3001)
	pnpm --filter admin dev

api-dev: ## Run Go API with hot reload (requires `air`)
	cd apps/api && air

dev: ## Run everything (web + admin + api) in parallel
	$(MAKE) -j3 web-dev admin-dev api-dev

lint: ## Lint everything
	pnpm lint
	cd apps/api && golangci-lint run ./...

typecheck: ## TypeScript typecheck
	pnpm typecheck

test: ## Run all tests
	pnpm test
	cd apps/api && go test -race ./...

build: ## Build all apps
	pnpm build
	cd apps/api && go build -o bin/api ./cmd/api

migrate-up: ## Apply all pending migrations
	migrate -path $(MIGRATIONS_DIR) -database "$(DB_DSN)" up

migrate-down: ## Roll back the last migration
	migrate -path $(MIGRATIONS_DIR) -database "$(DB_DSN)" down 1

migrate-new: ## Create a new migration pair (usage: make migrate-new name=add_xxx)
	migrate create -ext sql -dir $(MIGRATIONS_DIR) -seq $(name)

seed: ## Insert seed data
	cd apps/api && go run ./cmd/seed

minio-bootstrap: ## Create MinIO bucket idempotently
	@docker run --rm --network host \
		-e MC_HOST_local=http://$(MINIO_ROOT_USER):$(MINIO_ROOT_PASSWORD)@$(MINIO_ENDPOINT) \
		minio/mc:latest mb --ignore-existing local/$(MINIO_BUCKET)
	@echo "✓ Bucket $(MINIO_BUCKET) ready at $(MINIO_ENDPOINT)"

docker-up: ## Start Postgres + MinIO via docker-compose (skip if already running)
	docker compose up -d

docker-down: ## Stop docker-compose services
	docker compose down

clean: ## Remove build artifacts
	pnpm clean
	rm -rf apps/api/bin apps/api/tmp
