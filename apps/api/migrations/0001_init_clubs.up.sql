CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE club_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS clubs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL,
  name                text NOT NULL,
  address             text NOT NULL,
  lat                 double precision NOT NULL,
  lng                 double precision NOT NULL,
  description         text NOT NULL DEFAULT '',
  phones              text[] NOT NULL DEFAULT '{}',
  website             text,
  telegram_url        text,
  working_hours       jsonb NOT NULL DEFAULT '{}'::jsonb,
  games               text[] NOT NULL DEFAULT '{}',
  min_buy_in_cents    bigint,
  max_buy_in_cents    bigint,
  rake_description    text NOT NULL DEFAULT '',
  photo_keys          text[] NOT NULL DEFAULT '{}',
  status              club_status NOT NULL DEFAULT 'draft',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clubs_lat_range CHECK (lat BETWEEN -90 AND 90),
  CONSTRAINT clubs_lng_range CHECK (lng BETWEEN -180 AND 180),
  CONSTRAINT clubs_buyin_order CHECK (
    min_buy_in_cents IS NULL OR max_buy_in_cents IS NULL OR min_buy_in_cents <= max_buy_in_cents
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS clubs_slug_uniq ON clubs (slug);
CREATE INDEX IF NOT EXISTS clubs_lat_lng_idx ON clubs (lat, lng);
CREATE INDEX IF NOT EXISTS clubs_status_created_idx ON clubs (status, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS clubs_set_updated_at ON clubs;
CREATE TRIGGER clubs_set_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
