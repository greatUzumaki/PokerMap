package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pokermap/api/internal/config"
	"github.com/pokermap/api/internal/db"
	"github.com/pokermap/api/internal/seed"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	cfg, err := config.Load()
	if err != nil {
		logger.Error("load config", "err", err)
		os.Exit(1)
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("connect db", "err", err)
		os.Exit(1)
	}
	defer pool.Close()
	if err := seed.Run(ctx, db.New(pool), logger); err != nil {
		logger.Error("seed run", "err", err)
		os.Exit(1)
	}
	logger.Info("seed complete")
}
