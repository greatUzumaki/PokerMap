# admin-panel

## Purpose

Internal admin panel for PokerMap operators. Manages club catalog (CRUD, status workflow draft→published→archived), media uploads, audit log, and operator settings. Dark-themed dashboard shell with persistent sidebar navigation built on shadcn primitives shared via `@pokermap/ui`. Access gated by Telegram-authenticated admin session.
## Requirements
### Requirement: Dark theme by default

The admin panel SHALL render in dark theme on first paint, without depending on the operating-system `prefers-color-scheme` setting or a user toggle. The `<html>` element MUST carry the `dark` class on initial server render so there is no theme flash.

#### Scenario: First visit in a light-mode OS

- **WHEN** an authenticated admin loads any admin route on a device whose OS prefers light mode
- **THEN** the rendered page uses the dark CSS variable values (`--background` ≈ HSL 222 84% 4.9%, `--foreground` ≈ HSL 210 40% 98%)
- **AND** no light → dark flash is visible during hydration

#### Scenario: Tokens come from shared package

- **WHEN** a contributor inspects the computed CSS for `body { background: var(--background) }` in the admin app
- **THEN** the variable resolves to a value defined in `@pokermap/ui/globals.css`, not a duplicate definition inside `apps/admin/src/app/globals.css`

### Requirement: Persistent dashboard shell with sidebar

The admin panel SHALL render every authenticated route inside a dashboard shell composed of a left sidebar, a top header, and a main content pane. The sidebar MUST be persistent across navigations (no remount) and its open/collapsed state MUST be preserved across reloads.

#### Scenario: Sidebar is visible on every authed route

- **WHEN** an authenticated admin navigates from `/` to `/clubs` to any other authed route
- **THEN** the sidebar component instance is preserved (does not unmount between navigations)
- **AND** the active section indicator updates to match the current route

#### Scenario: Sidebar state persists across reloads

- **WHEN** an admin collapses the sidebar and reloads the page
- **THEN** the sidebar renders collapsed on the new page load

#### Scenario: Sidebar exposes core sections

- **WHEN** the sidebar is rendered
- **THEN** it shows clickable navigation entries for: Dashboard (`/`), Клубы (`/clubs`), Медиа (`/media`), Аудит (`/audit`), Настройки (`/settings`)
- **AND** each entry has an icon and a label
- **AND** each entry has a visible focus ring when reached via keyboard

### Requirement: Dashboard landing page

The route `/` for an authenticated admin SHALL render an overview dashboard, not a redirect to a sub-section.

#### Scenario: Dashboard shows club totals

- **WHEN** an admin loads `/`
- **THEN** the page renders KPI cards for total clubs, drafts, published, and archived counts
- **AND** the counts reflect the current database state (no stale cache older than the request)

#### Scenario: Dashboard shows recent activity

- **WHEN** an admin loads `/`
- **THEN** the page renders a list of the 5 most-recently-updated clubs with name, status badge, and updated-at timestamp
- **AND** each row links to that club's edit route

#### Scenario: Dashboard offers a primary action

- **WHEN** an admin loads `/`
- **THEN** a visually prominent "Добавить клуб" button links to `/clubs/new`

### Requirement: shadcn primitives shared via `@pokermap/ui`

UI primitives used by the admin shell — `Sidebar`, `Table`, `Tabs`, `DropdownMenu`, `Breadcrumb`, `Separator`, `Tooltip`, `Sheet`, `Skeleton`, `Card`, `Button`, `Badge`, `Input`, `Label`, `Textarea` — SHALL be exported from `@pokermap/ui`. The admin app MUST NOT define inline copies of these primitives under `apps/admin/src/components/ui`.

#### Scenario: No inline duplicates

- **WHEN** a contributor greps `apps/admin/src` for inline shadcn component definitions
- **THEN** no `components/ui/<primitive>.tsx` files exist that duplicate exports from `@pokermap/ui`

#### Scenario: Imports resolve from shared package

- **WHEN** any admin page imports a shadcn primitive
- **THEN** the import path begins with `@pokermap/ui/` (e.g. `@pokermap/ui/sidebar`)

### Requirement: Placeholder pages for non-implemented sections

Sidebar entries that do not yet have full functionality (Медиа, Аудит, Настройки) SHALL still resolve to a real route that renders an "В разработке" placeholder using the same shell.

#### Scenario: Placeholder renders inside the shell

- **WHEN** an admin clicks a sidebar entry for a not-yet-built section
- **THEN** the route loads inside the same sidebar shell and shows a `Card` with the heading "В разработке" and a short description
- **AND** no 404 is shown

### Requirement: Header carries breadcrumbs and user controls

The dashboard header above the main pane SHALL render breadcrumbs for the current location and a user menu with the admin's identity and a logout action.

#### Scenario: Breadcrumb reflects current path

- **WHEN** an admin is on `/clubs/<id>`
- **THEN** the header breadcrumb reads "Клубы › <club name>" and the first segment is a link back to `/clubs`

#### Scenario: User menu exposes logout

- **WHEN** an admin opens the user menu in the header
- **THEN** a menu item triggers the existing logout flow and ends the session

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

