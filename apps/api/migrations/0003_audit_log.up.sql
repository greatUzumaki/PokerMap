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
