package main

import (
	"context"
	"log/slog"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pokermap/api/internal/auth"
	"github.com/pokermap/api/internal/authh"
	"github.com/pokermap/api/internal/cache"
	"github.com/pokermap/api/internal/clubs"
	"github.com/pokermap/api/internal/config"
	"github.com/pokermap/api/internal/db"
	"github.com/pokermap/api/internal/health"
	"github.com/pokermap/api/internal/media"
	"github.com/pokermap/api/internal/middleware"
	"github.com/pokermap/api/internal/router"
	"github.com/pokermap/api/internal/server"
	"github.com/pokermap/api/internal/uploads"
)

func main() {
	if err := run(); err != nil {
		slog.Default().Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	logger := newLogger(cfg.LogLevel, cfg.IsProduction())
	slog.SetDefault(logger)
	cfg.LogWarnings(logger)

	ctx := context.Background()

	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return err
	}
	poolCfg.MaxConns = cfg.DatabaseMaxConns
	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return err
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		return err
	}
	queries := db.New(pool)

	mediaSvc, err := media.New(media.Config{
		Endpoint:     cfg.MinioEndpoint,
		AccessKey:    cfg.MinioAccessKey,
		SecretKey:    cfg.MinioSecretKey,
		UseSSL:       cfg.MinioUseSSL,
		Bucket:       cfg.MinioBucket,
		PublicURL:    cfg.MinioPublicURL,
		MaxSizeBytes: cfg.UploadMaxSizeBytes,
		URLTTL:       cfg.UploadURLTTL,
	})
	if err != nil {
		return err
	}

	cacheClient, err := cache.New(cfg.RedisURL, cfg.CacheKeyPrefix, logger)
	if err != nil {
		return err
	}
	defer cacheClient.Close()

	seedAdminsFromEnv(ctx, queries, cfg.AdminTelegramIDs, logger)

	issuer := auth.NewJWTIssuer(cfg.JWTSecret, cfg.JWTTTL)
	hasPlaceholder := len(cfg.HasPlaceholderSecrets()) > 0
	authHandler := authh.New(queries, issuer, cfg.TelegramBotToken, cfg.IsProduction(), hasPlaceholder)
	loginHandler := authh.NewLogin(cfg.SuperadminUsername, cfg.SuperadminPassword, issuer, cfg.IsProduction())
	if !loginHandler.Enabled() {
		logger.Warn("superadmin login disabled (SUPERADMIN_PASSWORD empty)")
	} else {
		logger.Info("superadmin login enabled", "username", cfg.SuperadminUsername)
	}

	deps := router.Deps{
		Logger:            logger,
		CORSOrigins:       cfg.CORSAllowedOrigins,
		Health:            health.New(pool, mediaSvc, cacheClient),
		Auth:              authHandler,
		Login:             loginHandler,
		Clubs:             clubs.New(queries, cacheClient, cfg.CacheTTL, logger),
		Uploads:           uploads.New(mediaSvc),
		SessionMiddleware: middleware.Session(issuer),
	}

	return server.Run(ctx, server.Options{
		Addr:    cfg.HTTPAddr,
		Handler: router.New(deps),
		Logger:  logger,
	})
}

func newLogger(level string, json bool) *slog.Logger {
	var lvl slog.Level
	if err := lvl.UnmarshalText([]byte(strings.ToUpper(level))); err != nil {
		lvl = slog.LevelInfo
	}
	opts := &slog.HandlerOptions{Level: lvl}
	if json {
		return slog.New(slog.NewJSONHandler(os.Stdout, opts))
	}
	return slog.New(slog.NewTextHandler(os.Stdout, opts))
}

func seedAdminsFromEnv(ctx context.Context, q *db.Queries, ids []int64, logger *slog.Logger) {
	if len(ids) == 0 {
		return
	}
	existing, err := q.ListAdmins(ctx)
	if err != nil {
		logger.Warn("could not list admins", "err", err)
		return
	}
	if len(existing) > 0 {
		return
	}
	for _, id := range ids {
		if err := q.UpsertAdmin(ctx, id, "seeded"); err != nil {
			logger.Warn("seed admin", "id", id, "err", err)
			continue
		}
		logger.Info("seeded admin", "telegram_user_id", id)
	}
}
