## 1. Подготовка

- [x] 1.1 Подтвердить, что `seed.Run` (или `seed.Seed`) оборачивается в транзакцию; если нет — обернуть `tx, err := db.Begin(ctx); defer tx.Rollback(); ...; tx.Commit()`.
- [x] 1.2 Подтвердить, что `user_events.entity_id` не имеет FK на `clubs(id)` (миграция `0005`). Если есть — задача в follow-up, в этом change не правим.

## 2. Сидер: чёрный список

- [x] 2.1 В `apps/api/internal/seed/seed_spb.go` (или `seed.go`, где объявлен) расширить `legacyDemoSlugs` пятью slug'ами: `bluff`, `pulse`, `elo-club`, `obriens-poker`, `cromulent-club`.
- [x] 2.2 Убедиться, что удаление по `legacyDemoSlugs` идёт ДО `UPSERT` новых записей.

## 3. Сидер: каталог спортивных клубов

- [x] 3.1 Полностью переписать массив `spbClubs` в `seed_spb.go` под 6 клубов (см. design.md):
  - `bad-beat` — 8-я Советская, 4, эт. 2; +7-903-431-33-33; TG `@bad_beat_club`; IG `@bad_beat_pokerclub`; `mtt-series`; entry 1000₽; published.
  - `raise-club` — Кожевенная линия, 30, лофт Brosko; site `raiseclubspb.ru`; ежедневно 19:00→02:00; `mtt-series`; entry 1000₽; published.
  - `spb-poker-club` — TG `@spb_poker_club`; site `spb-poker-club.ru`; адрес «уточняется через TG» (описание); `mtt-series`; entry 1000₽; published (есть постоянный канал, локация ротируется).
  - `overbet-club` — TG `@overbetspb`; IG `@pokerspb_club`; `mtt-series`; entry 1000₽; **draft** (нет фиксированной локации).
  - `joker-club-spb` — пр. Науки, 25; +7-995-629-37-85; TG `@joker_club_spb`; site `jokerclubspb.ru`; `mafia-and-poker`; entry 1000₽; **published** (сейчас draft → опубликовать).
  - `saint-pokersburg` — Невский пр., 65, 6 этаж (бар Mysterium); `mafia-and-poker`; entry уточнить — поставить 1500₽ как медиану лаунж-формата; published. Адрес поменять с «25» на «65».
- [x] 3.2 Каждый клуб: `MinBuyInCents = nil`, `MaxBuyInCents = nil`, `RakeDescription = ""`. `EntryFeeCents` обязателен (1000₽ или 1500₽).
- [x] 3.3 Координаты по адресам (приблизительно, копипастом из Yandex Карт — погрешность ≤ 50м допустима):
  - Bad Beat: 59.9389, 30.3793
  - Raise Club: 59.9264, 30.2491 (Севкабель)
  - SPB Poker Club: 59.9148, 30.3460 (Обводный 118 как fallback)
  - Overbet: 59.9343, 30.3351 (центр, плейсхолдер)
  - Joker Club SPB: 60.0067, 30.3957 (пр. Науки)
  - Saint-Pokersburg: 59.9311, 30.3604 (Невский 65)
- [x] 3.4 Над каждой структурой `db.CreateClubParams` поставить комментарий вида `// source: <url>, checked: 2026-05-24`.
- [x] 3.5 Описания (`Description`) — короткие 1–2 предложения: что за сообщество, формат «не на деньги, рейтинг», как попасть (через TG-канал).
- [x] 3.6 `WorkingHours` — `everyDayHours("19:00", "02:00")` как разумный дефолт для всех, кроме Joker (есть «каждый день», но без точного интервала) и Saint-Pokersburg (лаунж, по бронированию через ТГ — `everyDayHours("18:00", "06:00")`).
- [x] 3.7 `Games`: для всех — `["NLH", "MTT"]`. Для Joker + Saint-Pokersburg добавить `"Mixed"` (бывает мафия-микс).
- [x] 3.8 `SocialLinks`: заполнить `instagram`, `telegramChannel`, `vk` (если найден) — null для отсутствующих.

## 4. Локальная проверка

- [x] 4.1 `cd apps/api && go build ./...` — компиляция без ошибок.
- [x] 4.2 `cd apps/api && go test ./internal/seed/... ./internal/clubs/...` — все unit-тесты зелёные.
- [x] 4.3 `pnpm typecheck && pnpm lint` — фронтенд не сломан (он не зависит от сидера, но проверим CI-gate).
- [ ] 4.4 Локально запустить `docker compose up -d postgres` + `go run ./apps/api/cmd/api`, дать сидеру отработать, проверить `psql -c "SELECT slug, status, club_type, entry_fee_cents FROM clubs ORDER BY name"`:
  - 6 published + 1 draft (Overbet)
  - все `entry_fee_cents` не NULL
  - нет `bluff`/`pulse`/`elo-club`/`obriens-poker`/`cromulent-club`

## 5. Деплой и верификация на проде

- [ ] 5.1 Push в `main` → дождаться зелёного pipeline.
- [ ] 5.2 На проде: `ssh root@31.130.135.220 "docker exec platform-postgres psql -U platform -d poker -c \"SELECT slug, name, status, club_type FROM clubs ORDER BY name\""` — убедиться, что список соответствует §4.4.
- [ ] 5.3 Открыть `https://pargach.ru/poker` — все 6 published клубов отрисованы на карте и в `/list`. Bad Beat, Raise Club, Saint-Pokersburg видны по адресам.
- [ ] 5.4 Открыть `https://pargach.ru/poker/admin/clubs` — Overbet виден как draft, остальные published.

## 6. Документация

- [x] 6.1 В шапке `seed_spb.go` добавить комментарий-блок: критерий отбора («легальный спортивный покер, рейтинг-онли, без призовых, оргвзнос ≤ 1500₽, верифицированная локация или адрес-уточнение через ТГ»).
- [x] 6.2 Обновить `README.md` (корневой) — секция «Каталог клубов»: какие критерии для попадания в сидер. Достаточно 3–4 предложений.
