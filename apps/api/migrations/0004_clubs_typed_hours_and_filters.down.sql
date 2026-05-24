DROP INDEX IF EXISTS clubs_status_type_idx;

ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_social_links_object;
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_working_hours_object;
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_entry_fee_nonneg;

ALTER TABLE clubs DROP COLUMN IF EXISTS entry_fee_cents;
ALTER TABLE clubs DROP COLUMN IF EXISTS social_links;
ALTER TABLE clubs DROP COLUMN IF EXISTS club_type;

DROP TYPE IF EXISTS club_type;
