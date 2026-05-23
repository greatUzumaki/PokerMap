## ADDED Requirements

### Requirement: Telegram WebApp SDK initialization
The web app SHALL load `@telegram-apps/sdk-react` and wrap the App Router root layout in `<SDKProvider>`. The SDK SHALL initialize before the first interactive render and SHALL no-op gracefully when the app is opened outside Telegram.

#### Scenario: Opened inside Telegram
- **WHEN** the app loads inside a Telegram Mini App context
- **THEN** the SDK populates theme params, viewport, and initData; `<SDKProvider>` reports `isReady` true

#### Scenario: Opened in browser
- **WHEN** the app loads in a normal browser tab
- **THEN** the SDK initializes in mock/no-op mode, the app remains read-only, and admin routes are inaccessible

### Requirement: initData verification
The Go API SHALL expose `POST /v1/auth/telegram` which accepts the raw `initData` string. The endpoint SHALL verify the HMAC-SHA256 signature per the Telegram Mini App spec using `TELEGRAM_BOT_TOKEN`, reject `initData` whose `auth_date` is older than 24 hours, and on success issue a session cookie.

#### Scenario: Valid initData accepted
- **WHEN** the client sends a freshly-issued `initData` string from Telegram
- **THEN** the API responds 200, sets an httpOnly `Secure` `SameSite=Lax` cookie named `pm_session` containing a signed JWT with `tg_user_id` and `is_admin`, and returns the user profile JSON

#### Scenario: Tampered initData rejected
- **WHEN** the client sends an `initData` string whose `hash` does not match the recomputed signature
- **THEN** the API responds 401 with `{ error: { code: "invalid_initdata" } }`

#### Scenario: Stale initData rejected
- **WHEN** the client sends an `initData` whose `auth_date` is older than 24 hours
- **THEN** the API responds 401 with `{ error: { code: "initdata_expired" } }`

### Requirement: Theme adaptation
The web app SHALL bind Telegram theme parameters (`bg_color`, `text_color`, `hint_color`, `link_color`, `button_color`, `button_text_color`, `secondary_bg_color`) to CSS custom properties so the UI matches the user's Telegram theme (light/dark) automatically.

#### Scenario: Dark Telegram theme
- **WHEN** the user has a dark Telegram theme and opens the Mini App
- **THEN** the app renders in dark mode using the Telegram-provided colors rather than the OS preference

### Requirement: Viewport handling
The web app SHALL respect Telegram's reported viewport (`expand()` and viewport stable events) and lock the page height to `viewportStableHeight` to avoid scroll-bounce inside the Telegram WebView.

#### Scenario: Viewport expansion
- **WHEN** the Mini App is opened
- **THEN** the SDK calls `WebApp.expand()` and the layout fills the available height with no native scroll-overflow on the body

### Requirement: Native controls
The web app SHALL use Telegram `MainButton` to confirm primary actions inside flows that have a single primary action (e.g., "Build route" in club detail), and `BackButton` for non-root routes. Outside Telegram these controls SHALL render as conventional in-page buttons.

#### Scenario: BackButton in Telegram
- **WHEN** the user navigates from `/` to a club detail inside Telegram
- **THEN** Telegram's hardware back button (top-left chevron) becomes visible and tapping it returns to `/`

### Requirement: Haptic feedback
The web app SHALL trigger Telegram haptic feedback (`light` on tap, `medium` on confirm, `success`/`warning`/`error` on outcome toasts) when running inside Telegram, and SHALL skip haptics silently outside Telegram.

#### Scenario: Tap on marker triggers haptic
- **WHEN** a user inside Telegram taps a club marker
- **THEN** `hapticFeedback.impactOccurred('light')` fires before the detail sheet opens
