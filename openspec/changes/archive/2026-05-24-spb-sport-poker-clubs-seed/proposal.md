## Why

Текущий каталог СПб (7 клубов) смешивает кэш-клубы (Bluff, Pulse, Эло, O'Briens), серый PPPoker-фасад (Cromulent) и реально-спортивные сообщества (Joker Club SPB, Saint-Pokersburg). Бизнес-направление проекта — только **легальный спортивный покер не на деньги** (рейтинг ФСП-стиль, оргвзнос за стол, без призовых). Кэш-площадки и онлайн-кэш через PPPoker не должны фигурировать в публичной карте: они путают аудиторию и создают юридический риск. Каталог нужно сузить до сообществ-рейтинг-онли и **расширить** до полного списка ныне действующих клубов СПб (Bad Beat, Raise Club, SPB Poker Club, Overbet Club + два уже легитимных).

## What Changes

- **BREAKING**: Сидер каталога СПб (`apps/api/internal/seed/seed_spb.go`) перепишется на список из реальных спортивных клубов (только `mtt-series`/`mafia-and-poker`/новый `sport`-stub-через-`mtt-series`). `legacyDemoSlugs` расширится — туда добавляются текущие slug кэш-клубов (`bluff`, `pulse`, `elo-club`, `obriens-poker`, `cromulent-club`), чтобы при следующем запуске сидера они удалились с прода.
- Каждое значение `RakeDescription`/`MinBuyInCents`/`MaxBuyInCents` для оставшихся клубов очищается (рейк не применим: оргвзнос фиксированный, не процент). Поле `EntryFeeCents` обязательно для каждого нового клуба.
- Описание + социальные ссылки заполняются по факту: TG-каналы клубов, IG, веб-сайт, телефоны (из 2ГИС и Yandex Карт). Каждая запись комментирует Go-исходник ссылкой на проверенный источник + дата проверки (формат уже принят в spec'е).
- Расширяется требование `club-catalog` «Real Saint Petersburg poker clubs are seeded»: добавляется явный фильтр-исключение кэш-клубов и PPPoker-схем + минимум 6 опубликованных записей.
- Документ `apps/api/internal/seed/README.md` (или комментарий в `seed_spb.go`) описывает критерий отбора: «легальный, рейтинг-only, без призовых, оргвзнос не выше 1500₽».

## Capabilities

### New Capabilities
<!-- none — данные катологизируются, новый capability не нужен -->

### Modified Capabilities

- `club-catalog`: меняется requirement «Real Saint Petersburg poker clubs are seeded» — сужается до «sport-poker rating-only», добавляются legacy slugs кэш-клубов в чёрный список, требуется минимум 6 опубликованных клубов и обязательный `entry_fee_cents`.

## Impact

- **Code**: `apps/api/internal/seed/seed_spb.go` (полный rewrite массива), возможно `apps/api/internal/seed/seed.go` (расширение `legacyDemoSlugs`).
- **DB (prod)**: после деплоя сидер сделает `DELETE` по 5 slug'ам (`bluff`, `pulse`, `elo-club`, `obriens-poker`, `cromulent-club`) и `UPSERT` 6 спортивных клубов. Аналитика по этим клубам в `user_events` сохранится (FK не каскадит).
- **Frontend**: фильтры по `clubType` останутся, но реальные значения сузятся к `mtt-series`/`mafia-and-poker`/`club` — UI ломаться не должен (enum уже включает их).
- **No API contract changes**, **no migrations**.
