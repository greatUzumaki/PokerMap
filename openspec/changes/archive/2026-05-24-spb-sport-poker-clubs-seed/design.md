## Context

Каталог клубов СПб ведётся в Go-сидере `apps/api/internal/seed/seed_spb.go` — статический массив `db.CreateClubParams`, который при старте API делает `INSERT ... ON CONFLICT (slug) DO UPDATE`. Демо-клубы (`royal-poker-club`, …) уже удаляются через `legacyDemoSlugs`. Текущий прод (проверка 2026-05-24, см. `psql` выше) содержит:

| Slug | Тип | Реальный формат |
|---|---|---|
| `bluff` | cash | NLH/PLO кэш с 5% рейком — НЕ спортивный |
| `pulse` | mtt-series | кэш+турниры с buy-in 3–20k₽ — НЕ спортивный |
| `elo-club` | club | кэш+ивенты — НЕ спортивный |
| `obriens-poker` | mtt-series | паб O'Briens, кэш+MTT — НЕ спортивный |
| `cromulent-club` | underground | PPPoker-онлайн с рейкбэком — НЕ спортивный, юр.риск |
| `joker-club-spb` | mafia-and-poker (draft) | оргвзнос 1000₽, ТГ @joker_club_spb — **спортивный** |
| `saint-pokersburg` | mafia-and-poker | бар Mysterium на Невском 65 — **спортивный** |

Источники по новым клубам (все верифицированы 2026-05-24):

- **Bad Beat** — Yandex Maps + IG @bad_beat_pokerclub + TG @bad_beat_club. 8-я Советская, 4, 2 этаж. +7-903-431-33-33. До 02:00.
- **Raise Club** — raiseclubspb.ru + IG (через сайт). Кожевенная линия 30, лофт Brosko. Ежедневно с 19:00.
- **SPB Poker Club** — spb-poker-club.ru + TG @spb_poker_club. Адрес меняется (бывал Обводный 118АУ, бывал Loft Plan B / Арсенальная 2) → ставим базовый «адрес уточняется через ТГ» + ссылку на канал.
- **Overbet Poker Club** — TG @overbetspb + IG @pokerspb_club. Точного адреса нет (бронируется через ТГ), статус `draft`.
- **Joker Club SPB** — jokerclubspb.ru + TG @joker_club_spb. Пр. Науки, 25. Уже в БД как `draft` → перевести в `published`, заполнить детали.
- **Saint-Pokersburg** — fiesta.ru + Yandex Maps. Невский 65, 6 этаж, бар Mysterium. Адрес уточнить с 25 на 65.

## Goals / Non-Goals

**Goals:**
- Свести каталог СПб к 6 опубликованным сообществам спортивного покера (рейтинг, не на деньги).
- Удалить cash-клубы и PPPoker-фасады из публичного каталога.
- Сохранить аналитику (events) по удаляемым клубам (`telegram_user_id`/`entity_id` FK с `ON DELETE SET NULL`/нулевыми caskad — проверить).
- Не править схему БД, миграции, API-контракты.

**Non-Goals:**
- Не добавляем cash-клубы в каталог вообще (даже legal cash-площадок в РФ нет — все cash в СПб серые).
- Не добавляем дальние пригороды (Пушкин, Колпино) и Ленобласть.
- Не правим UI карты/списка — фильтры по `clubType` уже работают и enum уже принимает оставшиеся типы.
- Не правим телефоны клиента (всё на стороне сидера, без admin-UI работы).

## Decisions

### D1. Расширить `legacyDemoSlugs` вместо отдельной таблицы блок-листа

`seed.go` уже умеет удалять списком slug'ов перед `UPSERT`. Добавляем в `legacyDemoSlugs` пять слугов кэш-клубов. Преимущество: один проход, идемпотентно, переименование переменной не нужно (название устаревшее, но семантика «slug'и, которые сидер всегда удаляет» сохраняется). Альтернатива — отдельная константа `removedCashSlugs` — отвергнута, лишний код без выгоды.

### D2. `clubType` для спортивных сообществ — `mtt-series`

Все 6 клубов работают в формате «турнир с оргвзносом, рейтинг по итогам». Enum `mtt-series` для этого подходит точнее, чем `club` (общий) или `mafia-and-poker` (специфично, у Saint-Pokersburg/Joker есть и мафия). Решение: ставим `mtt-series` для Bad Beat, Raise Club, SPB Poker Club, Overbet. Saint-Pokersburg/Joker остаются `mafia-and-poker` (там реально и мафия проводится).

### D3. `EntryFeeCents` всегда заполнен; `MinBuyInCents`/`MaxBuyInCents` всегда `nil`

В спортивном формате нет buy-in (нельзя «купить» фишки за деньги). Есть только оргвзнос — фиксированный, отдельная семантика. Если для клуба точная сумма неизвестна (Bad Beat, Raise Club не публикуют), ставим `1000_00` (1000₽) как медиану по рынку + комментарий «уточнить».

### D4. Overbet Club → status `draft`

У Overbet нет публичного адреса — все встречи в разных местах по ТГ. Это нарушает требование «non-empty address» для `published`. Поэтому `draft` + описание объясняет принцип «адрес уточняется через TG @overbetspb». Опубликует админ вручную, когда узнает фиксированную локацию.

### D5. Не трогаем уже опубликованные cash-клубы напрямую (DELETE), полагаемся на сидер

Сидер запускается на старте API. После деплоя контейнер `poker-api` перезапустится и: (a) DELETE по 5 устаревшим slug'ам, (b) UPSERT 6 спортивных. Атомарность обеспечивается транзакцией `Run` в `seed.go` (надо подтвердить, что оборачивает в `tx`).

### D6. FK `user_events.entity_id → clubs.id` — поведение при DELETE

Миграция 0005 поставила `user_events.telegram_user_id REFERENCES users(...) ON DELETE SET NULL`. Для `entity_id` (UUID, без FK на `clubs` — оно opaque) удаление клуба не сломает аналитику: события останутся со старым `entity_id`, просто без живого FK. Подтвердим, что `entity_id` в `0005_users_and_events.up.sql` декларирован без FK на clubs — там `entity_id uuid` без REFERENCES, всё ок.

## Risks / Trade-offs

| Риск | Митигация |
|---|---|
| Bad Beat / Raise Club могут закрыться к моменту деплоя | Сидер источник правды → переоткроется только новым PR. UI показывает дату обновления, юзер видит несвежесть |
| Координаты приблизительные (геокодинг по адресу не делаем) | Маркер на карте может быть в 50–100м от реального входа — допустимо, админ может поправить через CRUD |
| Overbet в `draft` → не виден на публичной карте, но виден в админке | Это сознательное решение (D4) — `draft` фильтрация в `public/list` уже работает |
| Сидер удалит клуб, на который ссылается публичный URL | Slug-и cash-клубов (`bluff`, `pulse`, …) перестанут резолвиться — `/clubs/bluff` → 404. Внешних ссылок мало (продукт новый), приемлемо |
| Кто-то решит переоткрыть Bluff/Pulse как спортивный | Удалит из `legacyDemoSlugs` в новой PR + добавит новую запись с обновлённым контентом |

## Migration Plan

1. Edit `seed_spb.go` — заменить массив, добавить slug'и в `legacyDemoSlugs` (в `seed.go`).
2. Run `pnpm -F api lint && go test ./...` локально.
3. Commit + push в `main` → GHA пересоберёт образ `poker-api` → деплой на VPS → контейнер перезапустится → сидер отработает.
4. Verify on prod: `docker exec platform-postgres psql -U platform -d poker -c "SELECT slug, status FROM clubs ORDER BY name"` — должно остаться 6 published + 1 draft (Overbet).
5. Rollback: revert PR в Git → новый деплой → сидер откатит обратно (но cash-клубы при этом не вернутся — их `legacyDemoSlugs` удалит; чтобы реально откатить, нужно ручное `INSERT`).

## Open Questions

- Уточнить рабочие часы Bad Beat, Raise Club, Joker Club SPB по конкретным дням (сайт даёт общие «ежедневно с …» — ставим `everyDayHours`).
- Подтвердить, что `seed.Run` оборачивается в transaction (`db.Begin/Commit`). Если нет — отдельная задача в `tasks.md`.
