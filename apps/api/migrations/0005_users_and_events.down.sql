BEGIN;

CREATE TABLE IF NOT EXISTS audit_log (
  id                       bigserial PRIMARY KEY,
  actor_telegram_user_id   bigint NOT NULL,
  action                   text NOT NULL,
  entity_type              text NOT NULL,
  entity_id                uuid NOT NULL,
  diff                     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log (actor_telegram_user_id, created_at DESC);

INSERT INTO audit_log (actor_telegram_user_id, action, entity_type, entity_id, diff, created_at)
SELECT coalesce(telegram_user_id, 0),
       substr(kind, length('admin.') + 1),
       entity_type,
       entity_id,
       payload,
       occurred_at
FROM user_events
WHERE kind LIKE 'admin.%' AND entity_type IS NOT NULL AND entity_id IS NOT NULL;

ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_telegram_user_id_fk;

DROP TABLE IF EXISTS user_events;
DROP TABLE IF EXISTS users;

COMMIT;
