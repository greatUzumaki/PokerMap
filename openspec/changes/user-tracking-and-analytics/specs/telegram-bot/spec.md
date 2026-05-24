## ADDED Requirements

### Requirement: Telegram bot webhook endpoint

The api SHALL expose `POST /v1/tg/webhook` to receive Telegram Bot API updates. The endpoint SHALL authenticate inbound requests by comparing the `X-Telegram-Bot-Api-Secret-Token` header against the value of the `TELEGRAM_WEBHOOK_SECRET` environment variable. Requests with a missing or mismatched secret SHALL be rejected with `401` and SHALL NOT parse the request body.

#### Scenario: Valid update is accepted

- **WHEN** Telegram POSTs an Update payload to the webhook with the correct secret-token header
- **THEN** the api responds `200 OK` within 5 seconds
- **AND** the update is processed (see other requirements for what processing means per update type)

#### Scenario: Request without the secret header is refused

- **WHEN** any other client POSTs to the webhook URL without the secret-token header (or with a wrong value)
- **THEN** the api responds `401`
- **AND** no row is written to `users` or `user_events`

### Requirement: `/start` command registers the user and acknowledges

When the webhook receives an Update whose `message.text` equals `/start` (with or without a deep-link suffix), the api SHALL:

1. Upsert the sending user into the `users` table with every Telegram-provided profile field (`first_name`, `last_name`, `username`, `language_code`, `is_premium`, `is_bot`, `allows_write_to_pm`).
2. Append a `user_events` row with `kind='bot.start'`, `telegram_user_id` set to the sender, and a payload containing the chat id, the deep-link parameter if any, and the raw `update_id`.
3. Send a Russian-language welcome reply via Telegram `sendMessage` containing a Web App button that opens the Mini App at the public root.

#### Scenario: First-time /start

- **WHEN** a Telegram user with id `12345` who has never interacted before sends `/start` to the bot
- **THEN** `users` contains exactly one row with `telegram_user_id = 12345` and `first_seen_at` ≈ now
- **AND** `user_events` contains a row with `telegram_user_id = 12345`, `kind = 'bot.start'`, and `occurred_at` ≈ now
- **AND** the bot replies with a message that includes a `web_app` inline button pointing at the Mini App URL

#### Scenario: Repeat /start updates profile and last_seen

- **WHEN** the same user `12345` later changes their Telegram username from `oldname` to `newname` and sends `/start` again
- **THEN** the existing `users` row is updated so `username = 'newname'`, `last_seen_at` is bumped to now
- **AND** `first_seen_at` is preserved (not overwritten)
- **AND** a second `user_events` row with `kind = 'bot.start'` is appended

### Requirement: Self-healing webhook registration

If the environment variable `TELEGRAM_WEBHOOK_URL` is set, the api SHALL on startup call Telegram `getWebhookInfo`, compare the registered URL to `TELEGRAM_WEBHOOK_URL`, and call `setWebhook` (with the secret-token and `drop_pending_updates=true`) if they differ. Startup SHALL NOT fail if the call itself fails — the api logs a warning and proceeds, so a Telegram outage cannot prevent the service from starting.

#### Scenario: Webhook URL changes between deploys

- **WHEN** the previous deploy registered `https://old/...` and the new deploy runs with `TELEGRAM_WEBHOOK_URL=https://new/...`
- **THEN** the api calls `setWebhook` once on boot and Telegram begins delivering updates to the new URL within seconds
- **AND** a log line at INFO records "webhook updated old=… new=…"

#### Scenario: Telegram is unreachable at startup

- **WHEN** Telegram's API is down and the api boots
- **THEN** the api logs WARN "could not verify webhook" and continues serving normal traffic
- **AND** the api retries on the next boot
