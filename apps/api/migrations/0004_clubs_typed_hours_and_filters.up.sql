DO $$ BEGIN
  CREATE TYPE club_type AS ENUM ('cash', 'club', 'mtt-series', 'mafia-and-poker', 'underground');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS club_type       club_type NOT NULL DEFAULT 'cash';
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS social_links    jsonb     NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS entry_fee_cents bigint;

ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_entry_fee_nonneg;
ALTER TABLE clubs ADD  CONSTRAINT clubs_entry_fee_nonneg
  CHECK (entry_fee_cents IS NULL OR entry_fee_cents >= 0);

ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_working_hours_object;
ALTER TABLE clubs ADD  CONSTRAINT clubs_working_hours_object
  CHECK (jsonb_typeof(working_hours) = 'object');

ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_social_links_object;
ALTER TABLE clubs ADD  CONSTRAINT clubs_social_links_object
  CHECK (jsonb_typeof(social_links) = 'object');

CREATE INDEX IF NOT EXISTS clubs_status_type_idx ON clubs (status, club_type);
