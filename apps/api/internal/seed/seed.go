package seed

import (
	"context"
	"errors"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/pokermap/api/internal/db"
)

// Run prunes legacy demo rows and inserts the curated Saint Petersburg
// catalog from seed_spb.go. New rows are inserted with idempotent slug
// handling: a duplicate slug logs a warning and is skipped rather than
// failing the run.
func Run(ctx context.Context, q *db.Queries, logger *slog.Logger) error {
	if _, err := q.Pool().Exec(ctx,
		`DELETE FROM clubs WHERE slug = ANY($1)`, legacyDemoSlugs); err != nil {
		logger.Warn("seed: prune legacy demo slugs", "err", err)
	}
	for _, c := range spbClubs {
		_, err := q.CreateClub(ctx, c)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				continue
			}
			logger.Warn("seed: skipping club", "slug", c.Slug, "err", err)
			continue
		}
		logger.Info("seed: inserted club", "slug", c.Slug)
	}
	return nil
}
