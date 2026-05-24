## 1. Shared types + schema

- [x] 1.1 Add `packages/types/src/events.ts` exporting `EventKind` (zod enum), `EventPayload` schemas per kind, and helper `isEventKind(s)`. Re-export from `packages/types/src/index.ts`.
- [x] 1.2 Add migration `apps/api/migrations/0005_users_and_events.up.sql`: create `users`, `user_events`, add FK from `admins.telegram_user_id`, copy `audit_log` rows into `user_events` with `kind = 'admin.' || action`, drop `audit_log`. Wrap in an explicit `BEGIN`/`COMMIT`.
- [x] 1.3 Add the matching `0005_users_and_events.down.sql`: recreate `audit_log`, copy back rows where `kind LIKE 'admin.%'`, drop `users` and `user_events`, drop FK on `admins`.
- [x] 1.4 Regenerate `apps/api/internal/db/db.go` queries for the new tables (or hand-roll matching helpers — match existing style).

## 2. API — users package

- [x] 2.1 Create `apps/api/internal/users/` with `Upsert(ctx, profile)`, `Get(ctx, tgID)`, `List(ctx, params)`.
- [x] 2.2 Update `apps/api/internal/auth/telegram.go` so `TelegramUser` exposes `LanguageCode`, `PhotoURL`, `AllowsWriteToPM` parsed out of initData (initData has them under `user` JSON).
- [x] 2.3 Update `apps/api/internal/authh/handler.go::Telegram` to upsert the full profile through `users.Upsert` and to call `events.Record(ctx, "app.open", "", uuid.Nil, payload)`.
- [x] 2.4 Add `apps/api/internal/middleware/lastseen.go` that rate-limits via Redis (`SETEX last_seen:<id> 60 NX`) and updates `users.last_seen_at`. Plug into the `/v1` router so it runs after the session middleware.
- [x] 2.5 Update `seedAdminsFromEnv` in `cmd/api/main.go` so it creates a placeholder `users` row before inserting into `admins` (required by the new FK).

## 3. API — events package

- [x] 3.1 Create `apps/api/internal/events/` with `Record(ctx, kind, entityType, entityID, payload)` (insert), `List(ctx, filters)` (cursor pagination, filters), `Delete(ctx, id)`, `BulkDelete(ctx, filters, confirm)` (rejects unbounded), `Prune(ctx, olderThan)`.
- [x] 3.2 Wire `events.Prune` into a 24h-loop goroutine in `cmd/api/main.go` driven off `EVENTS_RETENTION_DAYS` (default 30). Fail-fast on `<= 0`.
- [x] 3.3 Add public `POST /v1/events` handler in `apps/api/internal/events/handler.go`. Validate kinds against the shared zod-equivalent Go list (`events.AllowedKinds`), cap batch at 10, cap payload at 4 KiB, run Redis sliding-window rate limit per `(actor, kind)`.
- [x] 3.4 Add admin endpoints `GET /v1/admin/events`, `DELETE /v1/admin/events/:id`, `DELETE /v1/admin/events` (with `to` required and `confirm=true`).
- [x] 3.5 Replace all current `audit_log` write paths in `apps/api/internal/clubs/` (and anywhere else `INSERT INTO audit_log` appears) with `events.Record(...)`. Diff-format unchanged.

## 4. API — Telegram bot webhook

- [x] 4.1 Create `apps/api/internal/bot/` with a `Handler` that:
  - Verifies the `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET`.
  - Parses a Telegram `Update` JSON.
  - For `/start`, upserts the user via `users.Upsert`, records `bot.start`, and replies with `sendMessage` including a `web_app` inline button to the Mini App URL.
  - Returns `200` even on no-op updates (Telegram will retry on non-200).
- [x] 4.2 Register the route `POST /v1/tg/webhook` (public, no session middleware) in `internal/router/router.go`.
- [x] 4.3 On api boot, if `TELEGRAM_WEBHOOK_URL` is set, call `getWebhookInfo` and `setWebhook` (with `secret_token = TELEGRAM_WEBHOOK_SECRET`) when the registered URL differs. Wrap in a goroutine so startup is non-blocking.
- [ ] 4.4 Add a tiny `apps/api/cmd/set-webhook/main.go` for manual one-shot registration (operator runs `go run ./cmd/set-webhook` against a dev env).

## 5. Web — client instrumentation

- [x] 5.1 Add `apps/web/src/lib/track.ts` — singleton emitter with `track(kind, payload?)`, batches up to 10 events / 2s, POSTs `/v1/events`. Drops batch silently on 4xx, logs `console.warn` on 5xx.
- [x] 5.2 Add `apps/web/src/components/track/TrackOnView.tsx` (intersection-observer-driven; fires once per mount) and `TrackOnClick.tsx` (wraps a child element and forwards the click).
- [x] 5.3 Add a `usePageView()` hook called from `app/layout.tsx` (inside the existing `<Suspense>`) that emits `web.page_view` on every `pathname` change.
- [x] 5.4 Mark high-value sites with the new helpers:
  - `MapFilters` — emit `web.filter_apply` on Готово (payload = the filter object), `web.filter_reset` on Сбросить.
  - `ClubSheet` — emit `web.club_view` via `<TrackOnView>` when open.
  - `OpenInMapsButton` — emit `web.openinmaps_click` (payload: slug, chosen provider).
  - `ClubSheet`/share button (if any) — emit `web.share_click`.
- [x] 5.5 Ensure no events fire while the page is in SSR — guard `track()` on `typeof window !== 'undefined'`.

## 6. Admin — Analytics page

- [x] 6.1 Rename `apps/admin/src/app/(authed)/audit/` → `analytics/`. Update `sidebar` to label "Аналитика" and link to `/analytics`.
- [x] 6.2 Build the filter bar: shadcn `DateRangePicker` (last 24h / 7d / 30d quick chips), `kind` multi-select fed from `@pokermap/types`, `telegramUserId` numeric input with debounced lookup against `/v1/admin/users?q=`, free-text `q` input.
- [x] 6.3 Build the rows: `name + username` of the actor, `kind` badge with color per family (bot.* / app.* / web.* / admin.*), relative `occurred_at` ("3m ago"), expand-on-click body.
- [x] 6.4 Per-row delete trash icon with optimistic UI. Re-uses the existing `Sonner` toaster for success/error.
- [x] 6.5 "Удалить все по фильтру" button in the top-right; disabled until `to` filter is set; opens a confirm dialog with `N matched` (fetched from `HEAD` of the listing endpoint).
- [x] 6.6 Server actions live in `app/(authed)/analytics/actions.ts` calling the api with the admin session cookie.

## 7. Admin — Users page

- [x] 7.1 Add `apps/admin/src/app/(authed)/users/page.tsx` (list) + `[telegramUserId]/page.tsx` (detail).
- [x] 7.2 Add sidebar entry "Пользователи" before "Аналитика".
- [x] 7.3 List columns: name, `@username`, `Premium` badge, `language`, first_seen, last_seen, event count, link to detail.
- [x] 7.4 Detail: full Telegram profile card on top, "Посмотреть в Аналитике" CTA, paged list of the user's events (re-using the Analytics row component).

## 8. Config + env

- [x] 8.1 Add env vars to `apps/api/internal/config/config.go`: `TelegramWebhookURL string` (optional), `TelegramWebhookSecret string` (required if URL set, ≥ 32 chars), `EventsRetentionDays int` (default 30; reject ≤ 0).
- [x] 8.2 Update `apps/api/.env.example` and `.env` accordingly. Document in the api README.
- [x] 8.3 Add `TELEGRAM_WEBHOOK_SECRET` as a repo GH secret + render into `.env` in `.github/workflows/pipeline.yml`. Compute the public webhook URL from `PUBLIC_API_URL`.
- [x] 8.4 On the VPS (one-time, operator): generate a 64-byte secret, set the GH secret, and after first deploy with the env wired, verify Telegram has registered the webhook (`getWebhookInfo` via `cmd/set-webhook` or curl).

## 9. Tests

- [ ] 9.1 Go unit test for the bot webhook: `/start` path inserts a user, writes a `bot.start` event, replies with a web_app button.
- [ ] 9.2 Go unit test for `events.Record` and the bulk-delete refusal when `to` is missing.
- [ ] 9.3 Go integration test (testcontainers postgres) for `events.Prune` with seeded old + recent rows.
- [ ] 9.4 Web vitest for `lib/track.ts` batching and silent-on-4xx behaviour.

## 10. Docs

- [ ] 10.1 Update `apps/api/README.md` with: bot webhook setup, `EVENTS_RETENTION_DAYS`, the events table schema, and a short "what we collect" privacy note.
- [ ] 10.2 Update the root `README.md`'s admin section to mention Analytics and Users pages.
