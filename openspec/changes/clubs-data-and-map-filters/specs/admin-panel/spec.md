## ADDED Requirements

### Requirement: Working hours are edited through a structured UI, not raw JSON

The admin club form SHALL render working hours through a dedicated `WorkingHoursEditor` component. The component MUST present one row per weekday (Mon–Sun, in that order), an "Открыт / Закрыт" toggle per row, time pickers for `open` and `close` per slot, a "Добавить слот" control per row, and bulk actions "Скопировать в Пн–Пт" and "Скопировать на все дни". The form MUST NOT expose the underlying JSON to the operator.

#### Scenario: Editor is the only working-hours input in the form

- **WHEN** an operator opens `/clubs/new` or `/clubs/<id>`
- **THEN** the rendered form contains no `<textarea>` whose `name` is `workingHours`
- **AND** the rendered form contains seven weekday rows with visible day labels (Пн, Вт, Ср, Чт, Пт, Сб, Вс)

#### Scenario: Toggling "Закрыт" hides slots and clears them on submit

- **WHEN** the operator flips the Wed row to "Закрыт" and submits
- **THEN** the submitted `workingHours` has `wed.closed === true` and `wed.slots === []`

#### Scenario: Adding a second slot creates a split shift

- **WHEN** the operator clicks "Добавить слот" on the Fri row and fills the new slot with `12:00`–`16:00` (existing slot is `20:00`–`06:00`)
- **THEN** the submitted `workingHours.fri.slots` has two entries in input order

#### Scenario: "Скопировать в Пн–Пт" applies the current row to weekdays

- **WHEN** the operator configures Mon as `18:00`–`06:00` and triggers "Скопировать в Пн–Пт" from the Mon row's overflow menu
- **THEN** Tue, Wed, Thu, Fri rows render the same slot
- **AND** Sat and Sun rows are unchanged

#### Scenario: Editor round-trips an existing club's hours without loss

- **WHEN** the operator opens an existing club whose persisted `workingHours.thu = { closed: false, slots: [{ open: "14:00", close: "23:00" }, { open: "23:30", close: "04:00" }] }`
- **THEN** the Thu row renders two slots in that order with those exact times
- **AND** submitting the form without changes results in an unchanged DB row

#### Scenario: Submitting malformed times surfaces a field-level error

- **WHEN** the API returns `400 invalid_working_hours` for a submitted form
- **THEN** the editor renders an error message beneath the affected day row, not as a generic banner only

### Requirement: Club form exposes structured social links and club type and entry fee

The admin club form SHALL render dedicated inputs for `clubType` (select), `entryFeeCents` (number), and a `socials` group with one input per platform: VK, Instagram, YouTube, Telegram channel. The legacy single `telegramUrl` input remains for the club's primary Telegram contact (chat/booking), distinct from the Telegram *channel* in `socials`.

#### Scenario: Club type select offers the canonical values

- **WHEN** the operator opens the form
- **THEN** the `clubType` `<select>` contains options with values `cash`, `club`, `mtt-series`, `mafia-and-poker`, `underground` in that order
- **AND** the default selection on a new-club form is `cash`

#### Scenario: Empty social inputs are submitted as omitted, not empty strings

- **WHEN** the operator leaves the VK input empty and submits
- **THEN** the persisted `social_links` JSON has no `vk` key (rather than `"vk": ""`)

#### Scenario: Entry fee accepts only non-negative integers

- **WHEN** the operator types `-100` in the entry-fee input and submits
- **THEN** the API responds `400` with a field-level error on `entryFeeCents` and the form keeps the entered value for correction

### Requirement: Form layout groups fields semantically

The club form SHALL group fields into visually separated sections: "Основное" (name, slug, type, status), "Локация" (address, coordinates + map picker), "Контакты" (phones, website, telegram, socials), "Игра" (games, buy-in, entry fee, rake), "Расписание" (working hours editor), "Описание", "Фотографии". Each group MUST be wrapped in a shared `Card` from `@pokermap/ui`.

#### Scenario: Sections are present and labeled

- **WHEN** the operator opens the form on desktop
- **THEN** seven `Card` elements are rendered, each with a visible heading matching one of the section names above, in that order
