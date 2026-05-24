## ADDED Requirements

### Requirement: Mutation handlers emit `user_events` instead of `audit_log` rows

The admin mutation handlers (`Insert`, `Update`, `Publish`, `Archive`, `Delete` on clubs and any future entity) SHALL emit a `user_events` row through the shared `events.Record(ctx, kind, entityType, entityID, diff)` helper. Direct writes to a legacy `audit_log` table SHALL NOT exist after this change. The `kind` value SHALL be `'admin.<entity>.<verb>'` (e.g. `'admin.club.update'`).

#### Scenario: Club update writes one event with the diff

- **WHEN** an admin publishes club `cb12` by changing `status: 'draft' → 'published'`
- **THEN** exactly one `user_events` row is written with `kind = 'admin.club.update'`, `entity_type = 'club'`, `entity_id = 'cb12'`, `payload` containing the field-level diff, `telegram_user_id` = the admin's id, `occurred_at` ≈ now

#### Scenario: Failed mutation writes no event

- **WHEN** an admin submits an invalid club update that fails validation
- **THEN** the mutation is rejected with `400` and no `user_events` row is written
