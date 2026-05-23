.PHONY: api-dev api-build api-test api-lint migrate-up migrate-down sqlc-gen openapi-gen tidy

DB_DSN ?= postgres://pokermap:pokermap@localhost:5432/pokermap?sslmode=disable

api-dev: ## Hot-reload via air
	air

api-build: ## Build the api binary
	CGO_ENABLED=0 go build -o bin/api ./cmd/api

api-test: ## Run tests with race detector
	go test -race -count=1 ./...

api-lint: ## Lint with golangci-lint
	golangci-lint run ./...

migrate-up:
	migrate -path migrations -database "$(DB_DSN)" up

migrate-down:
	migrate -path migrations -database "$(DB_DSN)" down 1

sqlc-gen:
	sqlc generate

openapi-gen:
	@echo "OpenAPI is hand-authored at api/openapi.yaml — regenerate TS client via 'pnpm --filter @pokermap/types types:gen'"

tidy:
	go mod tidy
