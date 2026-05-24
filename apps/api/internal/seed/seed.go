package seed

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/pokermap/api/internal/db"
)

const upsertClubSQL = `
	INSERT INTO clubs (slug, name, address, lat, lng, description, phones, website, telegram_url,
		working_hours, games, min_buy_in_cents, max_buy_in_cents, entry_fee_cents, rake_description,
		photo_keys, club_type, social_links, status)
	VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
	ON CONFLICT (slug) DO UPDATE SET
		name = EXCLUDED.name,
		address = EXCLUDED.address,
		lat = EXCLUDED.lat,
		lng = EXCLUDED.lng,
		description = EXCLUDED.description,
		phones = EXCLUDED.phones,
		website = EXCLUDED.website,
		telegram_url = EXCLUDED.telegram_url,
		working_hours = EXCLUDED.working_hours,
		games = EXCLUDED.games,
		min_buy_in_cents = EXCLUDED.min_buy_in_cents,
		max_buy_in_cents = EXCLUDED.max_buy_in_cents,
		entry_fee_cents = EXCLUDED.entry_fee_cents,
		rake_description = EXCLUDED.rake_description,
		photo_keys = EXCLUDED.photo_keys,
		club_type = EXCLUDED.club_type,
		social_links = EXCLUDED.social_links,
		status = EXCLUDED.status,
		updated_at = now()
`

// Run prunes legacy demo + retired cash slugs and upserts the curated Saint
// Petersburg sport-poker catalog inside a single transaction so a crash midway
// cannot leave the catalog half-applied.
func Run(ctx context.Context, q *db.Queries, logger *slog.Logger) error {
	tx, err := q.Pool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx,
		`DELETE FROM clubs WHERE slug = ANY($1)`, legacyDemoSlugs); err != nil {
		return err
	}

	for _, c := range spbClubs {
		social := c.SocialLinks
		if len(social) == 0 {
			social = []byte(`{}`)
		}
		if _, err := tx.Exec(ctx, upsertClubSQL,
			c.Slug, c.Name, c.Address, c.Lat, c.Lng, c.Description, c.Phones,
			c.Website, c.TelegramURL, c.WorkingHours, c.Games, c.MinBuyInCents,
			c.MaxBuyInCents, c.EntryFeeCents, c.RakeDescription, c.PhotoKeys,
			c.ClubType, social, c.Status,
		); err != nil {
			return err
		}
		logger.Info("seed: upserted club", "slug", c.Slug)
	}

	return tx.Commit(ctx)
}
