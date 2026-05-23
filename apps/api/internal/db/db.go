// Package db is a hand-rolled pgx repository.
// The canonical query definitions live in queries.sql + sqlc.yaml.
// Running `make sqlc-gen` from apps/api will replace this file with
// generated code. The hand-rolled version is kept committed so the
// service builds cleanly without sqlc installed locally.
package db

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type ClubStatus string

const (
	ClubStatusDraft     ClubStatus = "draft"
	ClubStatusPublished ClubStatus = "published"
	ClubStatusArchived  ClubStatus = "archived"
)

type Club struct {
	ID              uuid.UUID       `json:"id"`
	Slug            string          `json:"slug"`
	Name            string          `json:"name"`
	Address         string          `json:"address"`
	Lat             float64         `json:"lat"`
	Lng             float64         `json:"lng"`
	Description     string          `json:"description"`
	Phones          []string        `json:"phones"`
	Website         *string         `json:"website"`
	TelegramURL     *string         `json:"telegram_url"`
	WorkingHours    json.RawMessage `json:"working_hours"`
	Games           []string        `json:"games"`
	MinBuyInCents   *int64          `json:"min_buy_in_cents"`
	MaxBuyInCents   *int64          `json:"max_buy_in_cents"`
	RakeDescription string          `json:"rake_description"`
	PhotoKeys       []string        `json:"photo_keys"`
	Status          ClubStatus      `json:"status"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

type Admin struct {
	TelegramUserID int64     `json:"telegram_user_id"`
	DisplayName    string    `json:"display_name"`
	CreatedAt      time.Time `json:"created_at"`
}

type AuditLog struct {
	ID                  int64           `json:"id"`
	ActorTelegramUserID int64           `json:"actor_telegram_user_id"`
	Action              string          `json:"action"`
	EntityType          string          `json:"entity_type"`
	EntityID            uuid.UUID       `json:"entity_id"`
	Diff                json.RawMessage `json:"diff"`
	CreatedAt           time.Time       `json:"created_at"`
}

type Queries struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Queries {
	return &Queries{pool: pool}
}

func (q *Queries) Pool() *pgxpool.Pool { return q.pool }

const clubColumns = `id, slug, name, address, lat, lng, description, phones, website, telegram_url,
working_hours, games, min_buy_in_cents, max_buy_in_cents, rake_description, photo_keys, status,
created_at, updated_at`

func scanClub(row pgx.Row) (Club, error) {
	var c Club
	err := row.Scan(
		&c.ID, &c.Slug, &c.Name, &c.Address, &c.Lat, &c.Lng, &c.Description, &c.Phones,
		&c.Website, &c.TelegramURL, &c.WorkingHours, &c.Games, &c.MinBuyInCents, &c.MaxBuyInCents,
		&c.RakeDescription, &c.PhotoKeys, &c.Status, &c.CreatedAt, &c.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Club{}, ErrNotFound
	}
	return c, err
}

type ListPublishedClubsParams struct {
	MinLat, MaxLat, MinLng, MaxLng *float64
	CursorCreatedAt                *time.Time
	CursorID                       *uuid.UUID
	Limit                          int32
}

func (q *Queries) ListPublishedClubs(ctx context.Context, p ListPublishedClubsParams) ([]Club, error) {
	const sql = `
		SELECT ` + clubColumns + `
		FROM clubs
		WHERE status = 'published'
		  AND ($1::double precision IS NULL OR (
		    lng BETWEEN $1 AND $2
		    AND lat BETWEEN $3 AND $4
		  ))
		  AND ($5::timestamptz IS NULL OR (created_at, id) < ($5, $6))
		ORDER BY created_at DESC, id DESC
		LIMIT $7
	`
	rows, err := q.pool.Query(ctx, sql,
		p.MinLng, p.MaxLng, p.MinLat, p.MaxLat,
		p.CursorCreatedAt, p.CursorID, p.Limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Club, 0, p.Limit)
	for rows.Next() {
		c, err := scanClub(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (q *Queries) ListAllClubsAdmin(ctx context.Context, limit, offset int32) ([]Club, error) {
	rows, err := q.pool.Query(ctx,
		`SELECT `+clubColumns+` FROM clubs ORDER BY updated_at DESC LIMIT $1 OFFSET $2`,
		limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Club, 0, limit)
	for rows.Next() {
		c, err := scanClub(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (q *Queries) CountAllClubsAdmin(ctx context.Context) (int64, error) {
	var n int64
	err := q.pool.QueryRow(ctx, `SELECT count(*) FROM clubs`).Scan(&n)
	return n, err
}

func (q *Queries) GetClubBySlug(ctx context.Context, slug string) (Club, error) {
	return scanClub(q.pool.QueryRow(ctx,
		`SELECT `+clubColumns+` FROM clubs WHERE slug = $1 AND status = 'published'`,
		slug))
}

func (q *Queries) GetClubByID(ctx context.Context, id uuid.UUID) (Club, error) {
	return scanClub(q.pool.QueryRow(ctx,
		`SELECT `+clubColumns+` FROM clubs WHERE id = $1`,
		id))
}

type CreateClubParams struct {
	Slug, Name, Address, Description, RakeDescription string
	Lat, Lng                                          float64
	Phones, Games, PhotoKeys                          []string
	Website, TelegramURL                              *string
	WorkingHours                                      json.RawMessage
	MinBuyInCents, MaxBuyInCents                      *int64
	Status                                            ClubStatus
}

func (q *Queries) CreateClub(ctx context.Context, p CreateClubParams) (Club, error) {
	const sql = `
		INSERT INTO clubs (slug, name, address, lat, lng, description, phones, website, telegram_url,
			working_hours, games, min_buy_in_cents, max_buy_in_cents, rake_description, photo_keys, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		RETURNING ` + clubColumns
	return scanClub(q.pool.QueryRow(ctx, sql,
		p.Slug, p.Name, p.Address, p.Lat, p.Lng, p.Description, p.Phones, p.Website, p.TelegramURL,
		p.WorkingHours, p.Games, p.MinBuyInCents, p.MaxBuyInCents, p.RakeDescription, p.PhotoKeys, p.Status,
	))
}

type UpdateClubParams struct {
	ID              uuid.UUID
	Slug            *string
	Name            *string
	Address         *string
	Lat             *float64
	Lng             *float64
	Description     *string
	Phones          []string
	Website         *string
	TelegramURL     *string
	WorkingHours    json.RawMessage
	Games           []string
	MinBuyInCents   *int64
	MaxBuyInCents   *int64
	RakeDescription *string
	PhotoKeys       []string
	Status          *ClubStatus
}

func (q *Queries) UpdateClub(ctx context.Context, p UpdateClubParams) (Club, error) {
	const sql = `
		UPDATE clubs SET
			slug             = COALESCE($2,  slug),
			name             = COALESCE($3,  name),
			address          = COALESCE($4,  address),
			lat              = COALESCE($5,  lat),
			lng              = COALESCE($6,  lng),
			description      = COALESCE($7,  description),
			phones           = COALESCE($8,  phones),
			website          = COALESCE($9,  website),
			telegram_url     = COALESCE($10, telegram_url),
			working_hours    = COALESCE($11, working_hours),
			games            = COALESCE($12, games),
			min_buy_in_cents = COALESCE($13, min_buy_in_cents),
			max_buy_in_cents = COALESCE($14, max_buy_in_cents),
			rake_description = COALESCE($15, rake_description),
			photo_keys       = COALESCE($16, photo_keys),
			status           = COALESCE($17, status)
		WHERE id = $1
		RETURNING ` + clubColumns
	return scanClub(q.pool.QueryRow(ctx, sql,
		p.ID, p.Slug, p.Name, p.Address, p.Lat, p.Lng, p.Description, p.Phones, p.Website, p.TelegramURL,
		p.WorkingHours, p.Games, p.MinBuyInCents, p.MaxBuyInCents, p.RakeDescription, p.PhotoKeys, p.Status,
	))
}

func (q *Queries) ArchiveClub(ctx context.Context, id uuid.UUID) (Club, error) {
	return scanClub(q.pool.QueryRow(ctx,
		`UPDATE clubs SET status = 'archived' WHERE id = $1 RETURNING `+clubColumns, id))
}

func (q *Queries) ListAdmins(ctx context.Context) ([]Admin, error) {
	rows, err := q.pool.Query(ctx, `SELECT telegram_user_id, display_name, created_at FROM admins ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Admin
	for rows.Next() {
		var a Admin
		if err := rows.Scan(&a.TelegramUserID, &a.DisplayName, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (q *Queries) UpsertAdmin(ctx context.Context, telegramUserID int64, displayName string) error {
	_, err := q.pool.Exec(ctx, `
		INSERT INTO admins (telegram_user_id, display_name) VALUES ($1, $2)
		ON CONFLICT (telegram_user_id) DO UPDATE SET display_name = EXCLUDED.display_name
	`, telegramUserID, displayName)
	return err
}

func (q *Queries) IsAdmin(ctx context.Context, telegramUserID int64) (bool, error) {
	var ok bool
	err := q.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM admins WHERE telegram_user_id = $1)`, telegramUserID).Scan(&ok)
	return ok, err
}

type InsertAuditLogParams struct {
	Actor      int64
	Action     string
	EntityType string
	EntityID   uuid.UUID
	Diff       json.RawMessage
}

func (q *Queries) InsertAuditLog(ctx context.Context, p InsertAuditLogParams) error {
	if p.Diff == nil {
		p.Diff = json.RawMessage(`{}`)
	}
	_, err := q.pool.Exec(ctx,
		`INSERT INTO audit_log (actor_telegram_user_id, action, entity_type, entity_id, diff)
		 VALUES ($1, $2, $3, $4, $5)`,
		p.Actor, p.Action, p.EntityType, p.EntityID, p.Diff)
	return err
}

func (q *Queries) ListAuditLogForEntity(ctx context.Context, entityType string, entityID uuid.UUID, limit int32) ([]AuditLog, error) {
	rows, err := q.pool.Query(ctx, `
		SELECT id, actor_telegram_user_id, action, entity_type, entity_id, diff, created_at
		FROM audit_log
		WHERE entity_type = $1 AND entity_id = $2
		ORDER BY created_at DESC
		LIMIT $3
	`, entityType, entityID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AuditLog
	for rows.Next() {
		var a AuditLog
		if err := rows.Scan(&a.ID, &a.ActorTelegramUserID, &a.Action, &a.EntityType, &a.EntityID, &a.Diff, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
