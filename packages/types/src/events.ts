import { z } from "zod";

/**
 * Whitelist of event kinds accepted by `POST /v1/events` and emitted from
 * the bot, Mini App auth handler, and admin mutations. Keep in sync with
 * `apps/api/internal/events/kind.go`.
 */
export const EVENT_KINDS = [
  // Bot
  "bot.start",
  // Mini App lifecycle (server-emitted)
  "app.open",
  // Public web (client-emitted via POST /v1/events)
  "web.page_view",
  "web.filter_apply",
  "web.filter_reset",
  "web.club_view",
  "web.openinmaps_click",
  "web.share_click",
  // Admin mutations (server-emitted by events.Record from handler code)
  "admin.club.create",
  "admin.club.update",
  "admin.club.publish",
  "admin.club.archive",
  "admin.club.delete",
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

export const EventKindSchema = z.enum(EVENT_KINDS);

export function isEventKind(s: unknown): s is EventKind {
  return typeof s === "string" && (EVENT_KINDS as readonly string[]).includes(s);
}

/** Public/web kinds — what `POST /v1/events` accepts. */
export const PUBLIC_EVENT_KINDS: readonly EventKind[] = EVENT_KINDS.filter(
  (k) => k.startsWith("web."),
);

export const PublicEventKindSchema = z.enum(
  PUBLIC_EVENT_KINDS as unknown as [EventKind, ...EventKind[]],
);

/** Single event submitted by the browser. */
export const ClientEventSchema = z.object({
  kind: PublicEventKindSchema,
  payload: z.record(z.unknown()).optional(),
  occurredAt: z.string().datetime().optional(),
});
export type ClientEvent = z.infer<typeof ClientEventSchema>;

export const ClientEventsBatchSchema = z.object({
  events: z.array(ClientEventSchema).min(1).max(10),
});
export type ClientEventsBatch = z.infer<typeof ClientEventsBatchSchema>;

/** What the admin Analytics page receives per row. */
export const UserEventRecordSchema = z.object({
  id: z.string(),
  occurredAt: z.string(),
  telegramUserId: z.number().int().nullable(),
  sessionId: z.string().nullable(),
  kind: EventKindSchema,
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  payload: z.record(z.unknown()),
  requestIp: z.string().nullable(),
  userAgent: z.string().nullable(),
  actor: z
    .object({
      telegramUserId: z.number(),
      firstName: z.string(),
      lastName: z.string(),
      username: z.string().nullable(),
    })
    .nullable(),
});
export type UserEventRecord = z.infer<typeof UserEventRecordSchema>;

export const UserEventsListSchema = z.object({
  items: z.array(UserEventRecordSchema),
  nextCursor: z.string().nullable(),
});
export type UserEventsList = z.infer<typeof UserEventsListSchema>;

/** Telegram user profile as we persist it. */
export const UserProfileSchema = z.object({
  telegramUserId: z.number().int(),
  firstName: z.string(),
  lastName: z.string(),
  username: z.string().nullable(),
  languageCode: z.string().nullable(),
  isPremium: z.boolean(),
  isBot: z.boolean(),
  photoUrl: z.string().nullable(),
  allowsWriteToPm: z.boolean().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  lastActionAt: z.string().nullable(),
  eventCount: z.number().int().optional(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UsersListSchema = z.object({
  items: z.array(UserProfileSchema),
  nextCursor: z.string().nullable(),
});
export type UsersList = z.infer<typeof UsersListSchema>;
