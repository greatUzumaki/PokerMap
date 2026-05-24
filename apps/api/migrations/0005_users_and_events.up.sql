BEGIN;

-- ===== users — canonical Telegram identity =================================
CREATE TABLE IF NOT EXISTS users (
  telegram_user_id    bigint PRIMARY KEY,
  first_name          text NOT NULL DEFAULT '',
  last_name           text NOT NULL DEFAULT '',
  username            text,
  language_code       text,
  is_premium          boolean NOT NULL DEFAULT false,
  is_bot              boolean NOT NULL DEFAULT false,
  photo_url           text,
  allows_write_to_pm  boolean,
  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  last_action_at      timestamptz
);

CREATE INDEX IF NOT EXISTS users_last_seen_idx ON users (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username));

-- Back-fill users for every telegram_user_id we already know about.
INSERT INTO users (telegram_user_id, first_name, last_name)
SELECT a.telegram_user_id,
       coalesce(split_part(a.display_name, ' ', 1), ''),
       coalesce(NULLIF(substr(a.display_name, length(split_part(a.display_name, ' ', 1)) + 2), ''), '')
FROM admins a
ON CONFLICT (telegram_user_id) DO NOTHING;

INSERT INTO users (telegram_user_id)
SELECT DISTINCT actor_telegram_user_id
FROM audit_log
WHERE actor_telegram_user_id > 0
ON CONFLICT (telegram_user_id) DO NOTHING;

-- ===== admins now references users =========================================
ALTER TABLE admins
  ADD CONSTRAINT admins_telegram_user_id_fk
  FOREIGN KEY (telegram_user_id) REFERENCES users(telegram_user_id) ON DELETE CASCADE;

-- ===== user_events — append-only event log =================================
CREATE TABLE IF NOT EXISTS user_events (
  id                bigserial PRIMARY KEY,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  telegram_user_id  bigint REFERENCES users(telegram_user_id) ON DELETE SET NULL,
  session_id        text,
  kind              text NOT NULL,
  entity_type       text,
  entity_id         uuid,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_ip        inet,
  user_agent        text
);

CREATE INDEX IF NOT EXISTS user_events_occurred_at_idx ON user_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS user_events_user_occurred_idx ON user_events (telegram_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS user_events_kind_occurred_idx ON user_events (kind, occurred_at DESC);
CREATE INDEX IF NOT EXISTS user_events_payload_gin ON user_events USING GIN (payload);

-- Move existing audit_log rows into user_events.
INSERT INTO user_events (occurred_at, telegram_user_id, kind, entity_type, entity_id, payload)
SELECT created_at,
       NULLIF(actor_telegram_user_id, 0),
       'admin.' || action,
       entity_type,
       entity_id,
       diff
FROM audit_log;

DROP TABLE audit_log;

COMMIT;
