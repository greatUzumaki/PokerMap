CREATE TABLE IF NOT EXISTS admins (
  telegram_user_id  bigint PRIMARY KEY,
  display_name      text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now()
);
