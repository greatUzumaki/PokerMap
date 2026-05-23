-- name: ListPublishedClubs :many
-- Cursor pagination on (created_at DESC, id DESC). Optional bounding-box filter.
SELECT *
FROM clubs
WHERE status = 'published'
  AND (
    sqlc.narg('min_lng')::double precision IS NULL
    OR (lng BETWEEN sqlc.narg('min_lng')::double precision AND sqlc.narg('max_lng')::double precision
        AND lat BETWEEN sqlc.narg('min_lat')::double precision AND sqlc.narg('max_lat')::double precision)
  )
  AND (
    sqlc.narg('cursor_created_at')::timestamptz IS NULL
    OR (created_at, id) < (sqlc.narg('cursor_created_at')::timestamptz, sqlc.narg('cursor_id')::uuid)
  )
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg('lim');

-- name: ListAllClubsAdmin :many
SELECT *
FROM clubs
ORDER BY updated_at DESC
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: CountAllClubsAdmin :one
SELECT count(*) FROM clubs;

-- name: GetClubBySlug :one
SELECT *
FROM clubs
WHERE slug = sqlc.arg('slug') AND status = 'published';

-- name: GetClubByID :one
SELECT *
FROM clubs
WHERE id = sqlc.arg('id');

-- name: CreateClub :one
INSERT INTO clubs (
  slug, name, address, lat, lng, description, phones, website, telegram_url,
  working_hours, games, min_buy_in_cents, max_buy_in_cents, rake_description,
  photo_keys, status
) VALUES (
  sqlc.arg('slug'), sqlc.arg('name'), sqlc.arg('address'), sqlc.arg('lat'), sqlc.arg('lng'),
  sqlc.arg('description'), sqlc.arg('phones'), sqlc.narg('website'), sqlc.narg('telegram_url'),
  sqlc.arg('working_hours'), sqlc.arg('games'), sqlc.narg('min_buy_in_cents'),
  sqlc.narg('max_buy_in_cents'), sqlc.arg('rake_description'), sqlc.arg('photo_keys'),
  sqlc.arg('status')
)
RETURNING *;

-- name: UpdateClub :one
UPDATE clubs SET
  slug             = COALESCE(sqlc.narg('slug'), slug),
  name             = COALESCE(sqlc.narg('name'), name),
  address          = COALESCE(sqlc.narg('address'), address),
  lat              = COALESCE(sqlc.narg('lat'), lat),
  lng              = COALESCE(sqlc.narg('lng'), lng),
  description      = COALESCE(sqlc.narg('description'), description),
  phones           = COALESCE(sqlc.narg('phones'), phones),
  website          = COALESCE(sqlc.narg('website'), website),
  telegram_url     = COALESCE(sqlc.narg('telegram_url'), telegram_url),
  working_hours    = COALESCE(sqlc.narg('working_hours'), working_hours),
  games            = COALESCE(sqlc.narg('games'), games),
  min_buy_in_cents = COALESCE(sqlc.narg('min_buy_in_cents'), min_buy_in_cents),
  max_buy_in_cents = COALESCE(sqlc.narg('max_buy_in_cents'), max_buy_in_cents),
  rake_description = COALESCE(sqlc.narg('rake_description'), rake_description),
  photo_keys       = COALESCE(sqlc.narg('photo_keys'), photo_keys),
  status           = COALESCE(sqlc.narg('status'), status)
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: ArchiveClub :one
UPDATE clubs SET status = 'archived'
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: ListAdmins :many
SELECT * FROM admins ORDER BY created_at;

-- name: UpsertAdmin :exec
INSERT INTO admins (telegram_user_id, display_name)
VALUES (sqlc.arg('telegram_user_id'), sqlc.arg('display_name'))
ON CONFLICT (telegram_user_id) DO UPDATE
  SET display_name = EXCLUDED.display_name;

-- name: IsAdmin :one
SELECT EXISTS(SELECT 1 FROM admins WHERE telegram_user_id = sqlc.arg('telegram_user_id'));

-- name: InsertAuditLog :exec
INSERT INTO audit_log (actor_telegram_user_id, action, entity_type, entity_id, diff)
VALUES (sqlc.arg('actor'), sqlc.arg('action'), sqlc.arg('entity_type'), sqlc.arg('entity_id'), sqlc.arg('diff'));

-- name: ListAuditLogForEntity :many
SELECT * FROM audit_log
WHERE entity_type = sqlc.arg('entity_type') AND entity_id = sqlc.arg('entity_id')
ORDER BY created_at DESC
LIMIT sqlc.arg('lim');
