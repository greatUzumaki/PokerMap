// Package users persists Telegram identities. first_seen_at is sticky.
package users

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("user not found")

type Profile struct {
	TelegramUserID   int64     `json:"telegramUserId"`
	FirstName        string    `json:"firstName"`
	LastName         string    `json:"lastName"`
	Username         *string   `json:"username"`
	LanguageCode     *string   `json:"languageCode"`
	IsPremium        bool      `json:"isPremium"`
	IsBot            bool      `json:"isBot"`
	PhotoURL         *string   `json:"photoUrl"`
	AllowsWriteToPM  *bool     `json:"allowsWriteToPm"`
	FirstSeenAt      time.Time `json:"firstSeenAt"`
	LastSeenAt       time.Time `json:"lastSeenAt"`
	LastActionAt     *time.Time `json:"lastActionAt"`
	EventCount       int64     `json:"eventCount,omitempty"`
}

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

type UpsertInput struct {
	TelegramUserID  int64
	FirstName       string
	LastName        string
	Username        *string
	LanguageCode    *string
	IsPremium       bool
	IsBot           bool
	PhotoURL        *string
	AllowsWriteToPM *bool
}

func (s *Store) Upsert(ctx context.Context, in UpsertInput) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO users (
			telegram_user_id, first_name, last_name, username, language_code,
			is_premium, is_bot, photo_url, allows_write_to_pm,
			first_seen_at, last_seen_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
		ON CONFLICT (telegram_user_id) DO UPDATE SET
			first_name         = EXCLUDED.first_name,
			last_name          = EXCLUDED.last_name,
			username           = EXCLUDED.username,
			language_code      = EXCLUDED.language_code,
			is_premium         = EXCLUDED.is_premium,
			is_bot             = EXCLUDED.is_bot,
			photo_url          = COALESCE(EXCLUDED.photo_url, users.photo_url),
			allows_write_to_pm = COALESCE(EXCLUDED.allows_write_to_pm, users.allows_write_to_pm),
			last_seen_at       = now()
	`,
		in.TelegramUserID, in.FirstName, in.LastName, in.Username, in.LanguageCode,
		in.IsPremium, in.IsBot, in.PhotoURL, in.AllowsWriteToPM,
	)
	return err
}

// EnsureExists is used by admin seeding before the profile is known.
func (s *Store) EnsureExists(ctx context.Context, telegramUserID int64) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO users (telegram_user_id) VALUES ($1)
		ON CONFLICT (telegram_user_id) DO NOTHING
	`, telegramUserID)
	return err
}

func (s *Store) Get(ctx context.Context, telegramUserID int64) (Profile, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT telegram_user_id, first_name, last_name, username, language_code,
		       is_premium, is_bot, photo_url, allows_write_to_pm,
		       first_seen_at, last_seen_at, last_action_at,
		       (SELECT count(*) FROM user_events e WHERE e.telegram_user_id = users.telegram_user_id) AS event_count
		FROM users
		WHERE telegram_user_id = $1
	`, telegramUserID)
	return scanProfile(row)
}

type ListParams struct {
	Q     string
	Limit int
}

func (s *Store) List(ctx context.Context, p ListParams) ([]Profile, error) {
	limit := p.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	q := "%" + p.Q + "%"
	rows, err := s.pool.Query(ctx, `
		SELECT u.telegram_user_id, u.first_name, u.last_name, u.username, u.language_code,
		       u.is_premium, u.is_bot, u.photo_url, u.allows_write_to_pm,
		       u.first_seen_at, u.last_seen_at, u.last_action_at,
		       (SELECT count(*) FROM user_events e WHERE e.telegram_user_id = u.telegram_user_id) AS event_count
		FROM users u
		WHERE $1 = '' OR u.first_name ILIKE $2 OR u.last_name ILIKE $2 OR u.username ILIKE $2
		ORDER BY u.last_seen_at DESC
		LIMIT $3
	`, p.Q, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Profile, 0, limit)
	for rows.Next() {
		p, err := scanProfile(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// MarkSeen is rate-limited by the LastSeen middleware via Redis, not here.
func (s *Store) MarkSeen(ctx context.Context, telegramUserID int64) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET last_seen_at = now() WHERE telegram_user_id = $1`,
		telegramUserID,
	)
	return err
}

func (s *Store) MarkAction(ctx context.Context, telegramUserID int64) error {
	if telegramUserID <= 0 {
		return nil
	}
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET last_seen_at = now(), last_action_at = now() WHERE telegram_user_id = $1`,
		telegramUserID,
	)
	return err
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanProfile(r rowScanner) (Profile, error) {
	var p Profile
	if err := r.Scan(
		&p.TelegramUserID, &p.FirstName, &p.LastName, &p.Username, &p.LanguageCode,
		&p.IsPremium, &p.IsBot, &p.PhotoURL, &p.AllowsWriteToPM,
		&p.FirstSeenAt, &p.LastSeenAt, &p.LastActionAt,
		&p.EventCount,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Profile{}, ErrNotFound
		}
		return Profile{}, err
	}
	return p, nil
}
