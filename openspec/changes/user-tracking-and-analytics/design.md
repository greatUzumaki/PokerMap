## Context

PokerMap currently has three identity-shaped concepts:

- A Telegram **bot token** (env `TELEGRAM_BOT_TOKEN`) used only by `auth.VerifyInitData` to authenticate Mini App `initData`. The bot has no listener; pressing `/start` in Telegram results in nothing on our side.
- An **`admins`** table that stores `telegram_user_id` + `display_name`. Populated from `ADMIN_TELEGRAM_IDS` env on startup and via Telegram-authenticated admin mutations.
- An **`audit_log`** table that logs admin mutations only — `(actor_telegram_user_id, action, entity_type, entity_id, diff)`. Public traffic, bot interactions, and Mini App opens are not recorded.

`apps/api` is a single-binary Chi-based Go service behind Traefik, talking to shared Postgres + Redis + MinIO. The admin and web Next.js apps deploy as siblings. There is no observability/analytics stack (Prometheus / PostHog / Sentry) and the operator has explicitly said adding one is out of scope — they want to query a Postgres-backed event log from the admin panel.

Constraints:

- **Privacy / data minimisation**: capturing Telegram profile fields means PII. Must stay on the operator's VPS, never leave to a third party. Retention enforced at 30 days.
- **Cheap writes**: every authenticated request will touch `users.last_seen_at`. Must not become a hot row contention point for Postgres.
- **No bot SDK**: avoid pulling in `go-telegram-bot-api` for what is currently one command (`/start`). Hand-rolled JSON over `net/http` is fine.
- **Single VPS**: retention job is a goroutine in the api process; we deliberately avoid `pg_cron` or a separate scheduler.
- **Single deploy unit**: webhook URL changes are infrequent. A one-shot `set-webhook.sh` plus a self-heal on api boot covers the lifecycle.

Stakeholders: the operator (solo) and the eventual Mini App users.

## Goals / Non-Goals

**Goals:**

- Every Telegram user who has either pressed `/start` in the bot or opened the Mini App appears in the `users` table within seconds, with the full Telegram profile we are allowed to see.
- Every interesting user action — bot `/start`, app open, page view of the public web, filter change, club detail open, share, OpenInMaps click, every admin mutation — is appended to a single `user_events` table.
- Admin can navigate to `pargach.ru/poker/admin/analytics`, filter by kind / user / date / free text, and drill into payloads. Admin can navigate to `.../admin/users`, see every Telegram identity with last-seen timestamps, and click through to that user's activity.
- Data older than 30 days vanishes without operator action.
- The public POST `/v1/events` endpoint is safe from being used as a graffiti wall (rate limit, payload size cap, CORS lock).

**Non-Goals:**

- Real-time dashboards or aggregations (counts, charts, funnels). The Analytics page is a *list* with filters; aggregation can be added later or done via direct `psql`.
- Inbound bot commands beyond `/start`. `/help` etc. are out of scope; the webhook handler is structured to route on `message.text` so future commands plug in.
- Tracking truly anonymous web visitors (no Telegram session). The public `/v1/events` endpoint can still accept anonymous events tagged by a cookie-anchored session id, but users-table coverage is Telegram-only.
- Replacing or supplementing `audit_log` with anything richer than the equivalent rows it already has — the only point of the migration is to put admin mutations in the same shape as user events so a single page can show both.
- Backups of `user_events` (the table is ephemeral by design; `pg_dump` snapshot is fine for last 30 days, no PITR).

## Decisions

### D1: Webhook + Telegram secret token, not long-polling

**Choice:** Telegram bot integration via webhook. The api exposes `POST /v1/tg/webhook` (publicly reachable through Traefik at `https://pargach.ru/poker/api/v1/tg/webhook`). On api boot, if `TELEGRAM_WEBHOOK_URL` env is set and the current webhook does not match, the api self-heals by calling `setWebhook`. The webhook request body is authenticated by the `X-Telegram-Bot-Api-Secret-Token` header that Telegram echoes back from our `setWebhook` call.

**Rationale:** Webhook keeps the api stateless — no daemon goroutine to babysit on deploys, no long-running HTTPS connection. The secret-token header is sufficient to authenticate inbound requests without IP allow-listing or mTLS. Self-heal at boot prevents "I rotated the bot token and forgot to re-set the webhook" foot-guns.

**Alternatives:**

- *Long-polling goroutine inside api*: simpler config (no inbound URL), but it competes with normal HTTP traffic, complicates graceful shutdown, and silently breaks on deploys until the new container claims the update stream.
- *Separate bot worker container*: clean separation but introduces a second deploy unit and a duplicate Postgres connection — overkill for one command.

### D2: One unified `user_events` table

**Choice:** Single append-only table with the columns

```
id              bigserial primary key
occurred_at     timestamptz not null default now()
telegram_user_id bigint references users(telegram_user_id) on delete set null
session_id      text                                  -- cookie/Telegram session id, nullable for bot events
kind            text not null                         -- 'bot.start', 'app.open', 'web.page_view', 'web.filter_apply',
                                                      --  'web.club_view', 'web.openinmaps_click', 'admin.club.create', ...
entity_type     text                                  -- nullable, used for admin actions
entity_id       uuid                                  -- nullable
payload         jsonb not null default '{}'::jsonb
request_ip      inet                                  -- nullable, captured server-side
user_agent      text                                  -- nullable
```

Indexes: `(occurred_at desc)`, `(telegram_user_id, occurred_at desc)`, `(kind, occurred_at desc)`, GIN on `payload`.

Migration `0005_users_and_events` creates the tables, copies existing `audit_log` rows in with `kind = 'admin.' || action`, and drops `audit_log`.

**Rationale:** One table = one retention policy, one query path, one Analytics page that needs no UNION ALL gymnastics. Admin mutations and user events have the same shape (`who / when / what / payload`); splitting them was an accident of evolution, not a principle.

**Alternatives:**

- *Keep `audit_log` + add `user_events`*: forces the admin page to UNION two tables, doubles the retention/delete code, and the operator has to remember which lives where when answering a question.
- *EAV-style table with attribute rows*: pure data-warehouse pattern, total overkill.

### D3: `users` table is the canonical Telegram identity; `admins` becomes a role link

**Choice:**

```
users (
  telegram_user_id    bigint primary key,
  first_name          text not null default '',
  last_name           text not null default '',
  username            text,
  language_code       text,
  is_premium          boolean not null default false,
  is_bot              boolean not null default false,
  photo_url           text,
  allows_write_to_pm  boolean,
  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  last_action_at      timestamptz
)

admins (
  telegram_user_id  bigint primary key references users(telegram_user_id) on delete cascade,
  display_name      text not null default '',
  created_at        timestamptz not null default now()
)
```

Upsert callers: bot webhook on `/start`, Mini App auth handler, and any admin-add path. `last_action_at` is bumped from the event-write path; `last_seen_at` is bumped from a cheap middleware on every authenticated request.

**Rationale:** Telegram identity and "is an admin" are different concerns. Foreign-keying `admins` into `users` means we cannot accidentally create an orphan admin or lose a user's profile when admin status is revoked.

**Alternatives:**

- *Flatten everything into `admins`*: cannot represent non-admin Telegram users, which is exactly the new requirement.
- *Move `is_admin` onto `users`*: tempting, but the `admins` table has its own metadata (`display_name`, `created_at`) and a clean FK relation reads better at query time.

### D4: Write paths

| Action | Where it fires | What is written |
|---|---|---|
| User taps `/start` in bot | `bot.WebhookHandler` | `users` upsert (full profile from Telegram update). `user_events` row `kind='bot.start'`, `payload={chat_id, from}` |
| Mini App opens (any page) | `POST /v1/auth/telegram` | `users` upsert from `initData.user`. `user_events` row `kind='app.open'`, `payload={platform, version}` from initData. Sets/refreshes `pm_session` cookie |
| Authenticated request | `mw.LastSeen` middleware | UPDATE `users.last_seen_at` (and `last_action_at` if a non-readonly route). Coalesced via Redis (`SETEX 60s` lock) to avoid >1 update per minute per user |
| High-value web action | `apps/web` client → `POST /v1/events` | `user_events` row. Payload validated against the zod schema in `@pokermap/types`. `kind` whitelisted server-side |
| Admin mutation | existing handlers via `events.Record(ctx, kind, entityType, entityID, diff)` | Replaces direct INSERT into `audit_log` |

Server attaches `request_ip` and `user_agent` automatically on the public `/v1/events` endpoint.

### D5: Client instrumentation

Two patterns in `apps/web`:

1. **Explicit hook** for actions tied to a callback:
   ```tsx
   const track = useTrack();
   <Button onClick={() => { track("web.filter_apply", { games, types, ... }); apply(); }}>
   ```

2. **Declarative wrapper** for view-on-mount actions:
   ```tsx
   <TrackOnView kind="web.club_view" payload={{ slug: club.slug }} />
   ```

Both wrap a single `lib/track.ts` emitter that:

- Batches up to 10 events or 2s into one POST.
- Drops the batch silently on 4xx (never blocks UI).
- Includes the current Telegram `session_id` from `useTelegram()` if available, falls back to a `localStorage`-backed anonymous id.

`apps/admin` does NOT instrument client-side — its mutations are already covered by the server-side `events.Record` call. Admin reads (page views) are not tracked by default; if the operator later wants them, the same hook plugs in.

A zod-validated `EventKind` enum lives in `@pokermap/types/src/events.ts` and is shared by api (used to whitelist incoming kinds) and web (used to type the emitter).

### D6: Public `POST /v1/events` rate-limiting

The endpoint is publicly reachable. Rate limit at Traefik (`rate-limit-default` already in `dynamic.yml`) plus an in-process Redis-backed sliding window per `(telegram_user_id or session_id, kind)`: max 20 events per 10 seconds, 200 events per minute. Payload capped at 4 KB. `kind` must be in the whitelist or the api responds `400 invalid_kind`.

### D7: Retention — daily prune goroutine

**Choice:** A goroutine in `cmd/api/main.go` wakes at 03:00 server time (or every 24 h after first delay), runs `DELETE FROM user_events WHERE occurred_at < now() - interval '30 days'` in batches of 10 000 rows. Logs the deletion count to slog. Configurable via `EVENTS_RETENTION_DAYS` env (default 30, must be > 0).

**Rationale:** Single VPS, single api process — same place that knows the DSN. No need for `pg_cron` extension on shared Postgres. Crash-safe because deletions are idempotent.

**Alternatives:**

- *`pg_cron` extension*: a separate moving part to install on the shared Postgres; a project-level retention policy is a project concern, not a platform concern.
- *postgres-backup-local schedule trick*: wrong tool for the job.

### D8: Admin Analytics + Users pages

`apps/admin/src/app/(authed)/audit/` is **renamed** to `analytics/` (not duplicated — the sidebar label, URL, and breadcrumb all change). The current list-of-rows UI stays; we add:

- Top filter bar: date range pickers (last 24h / last 7d / last 30d quick chips + custom range), `kind` multi-select fed from the same `EventKind` enum, free-text `q` searched against `payload` (`payload::text ILIKE %q%`), `telegramUserId` lookup with autocomplete.
- Row expand-on-click to reveal the full `payload` JSON.
- Per-row trash icon → `DELETE /v1/admin/events/:id` with optimistic UI.
- Top-right "Delete all" → modal `"Удалить N записей, соответствующих фильтру?"` → `DELETE /v1/admin/events?from=...&to=...&kind=...`. Requires a date upper bound to avoid accidental whole-table wipe; backend rejects unbounded `to` with `400 unbounded_delete`.
- Pagination: cursor by `(occurred_at, id)` desc.

`apps/admin/src/app/(authed)/users/` is **new**:

- Default sort: `last_seen_at desc`.
- Columns: name (first + last), username (mailto-style `@`), language, premium badge, first_seen, last_seen, event count (subquery — capped by retention so it's small).
- Row click → `/admin/users/[telegramUserId]` → user detail (full profile, table of recent events for that user, "View in Analytics" link).
- Search by username/name fragment.

Both pages reuse the existing dashboard shell and the shadcn primitives in `@pokermap/ui`.

### D9: `last_seen_at` update is rate-limited per user via Redis

**Choice:** The `mw.LastSeen` middleware tries `SET last_seen:<tg_id> 1 EX 60 NX` on Redis. On success (key did not exist), it issues an `UPDATE users SET last_seen_at = now() WHERE telegram_user_id = $1`. Otherwise it skips. This caps DB writes at one per user per minute.

**Rationale:** A heavy Mini App user could fire 10 GETs/sec — without coalescing, that's 600 row updates/min/user. Redis dedup turns it into 1/min.

## Risks / Trade-offs

- **PII storage**: capturing `first_name`/`username`/`photo_url` of every visitor expands the data we are responsible for. → Mitigated by per-project Postgres role + the firewall posture from `vps-platform`. Documented in `apps/api/README.md`. Operator decides whether to mention this in a privacy notice.
- **Webhook is publicly reachable**: anyone can POST to `/v1/tg/webhook`. → Mitigated by the Telegram secret-token header check, which we configure during `setWebhook`. Without the correct header value, the api returns `401` and does not parse the body. The secret is a 64-byte random kept in `TELEGRAM_WEBHOOK_SECRET` env.
- **Public `/v1/events` can be abused** to flood the table. → Mitigated by Traefik rate limit + Redis sliding window + kind whitelist + payload cap. Worst case: a single attacker can write ~1 row/3 s per IP, retention bounds the damage.
- **Migration from `audit_log` is one-shot**: dropping the old table means an aborted deploy could leave us with a half-converted schema. → Mitigated by writing the migration so it is fully transactional: `BEGIN; INSERT INTO user_events SELECT ... FROM audit_log; DROP TABLE audit_log; COMMIT;`. Down migration recreates `audit_log` and re-fills from events where `kind LIKE 'admin.%'`.
- **`last_seen` lag of 60 s** is acceptable for an admin viewing "who was here recently"; not acceptable if anyone ever builds presence/online indicators on top. Document the granularity.
- **30-day retention loses long-tail history**. Acceptable per requirements; operator can override `EVENTS_RETENTION_DAYS` if they want more, at the cost of unbounded growth.

## Migration Plan

1. **Schema first, code-paths reading old API second** — ship the `users` + `user_events` tables and the `audit_log → user_events` migration in one PR. The admin-panel old `audit` page keeps working because the events endpoint preserves the old shape under a `kind LIKE 'admin.%'` filter until the new Analytics page lands.
2. **Bot webhook + Mini App upsert** — wire the webhook and the auth handler to upsert into `users`. Set the webhook via `set-webhook.sh` (operator-run, once). At this point bot `/start` writes events and Mini App opens write events; no client-side instrumentation yet.
3. **Public events endpoint + client instrumentation** — land `POST /v1/events`, the zod schema, the rate limit, and the web hooks. Add `data-event` markup to the high-value call sites.
4. **Analytics page** — rename `audit` → `analytics`, add the filters and bulk delete.
5. **Users page** — list + detail + per-user analytics link.
6. **Retention goroutine** — start the daily prune. Verify on a Sunday morning that the count drops.

Rollback: each PR is reversible. The migration's down step restores `audit_log` from events, so the old admin Audit page can be unrenamed if needed.

## Open Questions

- **Welcome reply on `/start`** — the message body and whether to attach an inline button that opens the Mini App. Reasonable default: "Привет! Открой карту покер-клубов СПб → [кнопка]". Will draft in tasks.
- **`is_premium`-based feature gating** — out of scope here, but the column is captured so future code can branch on it.
- **Anonymous-visitor event ingestion** — supported by the schema (`telegram_user_id` is nullable), but the public web is currently Telegram-gated, so anonymous events are theoretically possible only via `apps/web/src/app/about/` and similar non-auth pages. Acceptable scope.
- **Cleanup of `apps/admin/src/app/(authed)/audit/`** — rename, don't duplicate. Confirmed in D8.
