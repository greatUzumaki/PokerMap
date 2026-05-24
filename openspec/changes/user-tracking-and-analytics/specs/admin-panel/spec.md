## ADDED Requirements

### Requirement: Analytics page replaces the Audit page

The admin panel SHALL rename the `(authed)/audit` route to `(authed)/analytics`. The sidebar label SHALL read "Аналитика" (no longer "Аудит"). The page SHALL show rows from `user_events` (no longer the legacy `audit_log`) with server-side filters for date range, `kind` multi-select, `telegramUserId` lookup, and free-text search. Default date range SHALL be the last 7 days.

#### Scenario: Sidebar navigation

- **WHEN** an admin clicks "Аналитика" in the sidebar
- **THEN** the URL is `/admin/analytics` and the page lists `user_events` rows newest-first

#### Scenario: Filter by kind

- **WHEN** the admin selects `kind = web.club_view`
- **THEN** only club-view events from the chosen date range are shown
- **AND** the URL contains the filter (`?kind=web.club_view&from=...&to=...`) so the view is shareable and survives reload

#### Scenario: Row expansion shows payload

- **WHEN** the admin clicks a row
- **THEN** the row expands inline to show the formatted `payload` JSON and any `entity_type`/`entity_id`

### Requirement: Manual deletion UI

The Analytics page SHALL provide a trash icon on each row that calls `DELETE /v1/admin/events/:id` with optimistic UI, and a top-right "Удалить все по фильтру" action that opens a confirmation dialog ("Удалить N записей за указанный период?") and calls the bulk-delete endpoint with the current filter plus `confirm=true`. The bulk action SHALL be disabled unless the current filter has an upper time bound.

#### Scenario: Per-row delete

- **WHEN** the admin clicks the trash icon on a single row
- **THEN** the row is removed from the list immediately, the DELETE call is sent, and on success no further UI update is needed; on failure the row reappears with an error toast

#### Scenario: Bulk delete needs a time bound

- **WHEN** the current filter has no `to` value set
- **THEN** the "Удалить все по фильтру" button is disabled with a tooltip "Установите верхнюю границу периода"

#### Scenario: Confirmed bulk delete

- **WHEN** the admin chooses last-7-days, filters by `kind = web.openinmaps_click`, and confirms bulk delete
- **THEN** the matching rows are deleted server-side, the count is reported in a toast, and the page refreshes the listing

### Requirement: New Users page

The admin panel SHALL include a `(authed)/users` route with a "Пользователи" sidebar entry. The page SHALL list `users` rows with columns: name (first + last), username, language, premium badge, first_seen, last_seen, and total events in retention window. Default sort SHALL be `last_seen_at DESC`. A free-text search SHALL match against `first_name`, `last_name`, and `username`. Each row SHALL link to `/admin/users/:telegramUserId`.

#### Scenario: User list is sorted by last seen

- **WHEN** an admin opens `/admin/users` and three users have last_seen at T, T-1h, T-2h
- **THEN** the list shows the most recent user first

#### Scenario: User detail shows activity

- **WHEN** the admin clicks a row
- **THEN** the detail page shows the full Telegram profile and a chronological list of that user's events
- **AND** a "Посмотреть в Аналитике" link opens `/admin/analytics?telegramUserId=<id>` pre-filtered

#### Scenario: Search by username fragment

- **WHEN** the admin types `iva` in the search box and a user with `username='ivan42'` exists
- **THEN** that user's row appears in the filtered list
