import { z } from "zod";

export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export const ClubStatus = z.enum(["draft", "published", "archived"]);
export type ClubStatus = z.infer<typeof ClubStatus>;

export const Game = z.enum(["NLH", "PLO", "PLO5", "MTT", "SnG", "Mixed", "Other"]);
export type Game = z.infer<typeof Game>;

const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:mm");

export const WorkingHoursSlot = z
  .object({
    open: TimeOfDay,
    close: TimeOfDay,
  })
  .refine((s) => s.open !== s.close, { message: "open and close must differ" });
export type WorkingHoursSlot = z.infer<typeof WorkingHoursSlot>;

export const WorkingDay = z
  .object({
    closed: z.boolean().default(false),
    // Tolerate `null` for empty slot arrays — Go marshals nil slices as JSON null.
    slots: z.preprocess((v) => v ?? [], z.array(WorkingHoursSlot).max(4)),
  })
  .refine((d) => !d.closed || d.slots.length === 0, {
    message: "closed days cannot have slots",
    path: ["slots"],
  });
export type WorkingDay = z.infer<typeof WorkingDay>;

export const WorkingHours = z.object({
  mon: WorkingDay,
  tue: WorkingDay,
  wed: WorkingDay,
  thu: WorkingDay,
  fri: WorkingDay,
  sat: WorkingDay,
  sun: WorkingDay,
});
export type WorkingHours = z.infer<typeof WorkingHours>;

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export function defaultWorkingHours(): WorkingHours {
  const day: WorkingDay = { closed: true, slots: [] };
  return { mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day };
}

export function parseWorkingHours(raw: unknown): WorkingHours {
  return WorkingHours.parse(raw);
}

export function safeParseWorkingHours(raw: unknown):
  | { ok: true; value: WorkingHours }
  | { ok: false; error: string } {
  const r = WorkingHours.safeParse(raw);
  if (r.success) return { ok: true, value: r.data };
  const first = r.error.issues[0];
  return { ok: false, error: first ? `${first.path.join(".")}: ${first.message}` : "invalid working hours" };
}

export const ClubType = z.enum([
  "cash",
  "club",
  "mtt-series",
  "mafia-and-poker",
  "underground",
]);
export type ClubType = z.infer<typeof ClubType>;

export const SocialLinks = z
  .object({
    vk: z.string().url().optional(),
    instagram: z.string().url().optional(),
    youtube: z.string().url().optional(),
    telegramChannel: z.string().url().optional(),
  })
  .default({});
export type SocialLinks = z.infer<typeof SocialLinks>;

export const Club = z.object({
  id: z.string().uuid(),
  slug: z.string().regex(SLUG_REGEX),
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  description: z.string().max(20000).default(""),
  phones: z.array(z.string().max(40)).default([]),
  website: z.string().url().nullable().default(null),
  telegramUrl: z.string().url().nullable().default(null),
  workingHours: WorkingHours,
  games: z.array(Game).default([]),
  minBuyInCents: z.number().int().min(0).nullable().default(null),
  maxBuyInCents: z.number().int().min(0).nullable().default(null),
  entryFeeCents: z.number().int().min(0).nullable().default(null),
  rakeDescription: z.string().max(500).default(""),
  photoKeys: z.array(z.string()).default([]),
  clubType: ClubType.default("cash"),
  socialLinks: SocialLinks,
  status: ClubStatus,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type Club = z.infer<typeof Club>;

export const ClubCreateInput = Club.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
}).extend({
  status: ClubStatus.default("draft"),
});
export type ClubCreateInput = z.infer<typeof ClubCreateInput>;

export const ClubUpdateInput = ClubCreateInput.partial();
export type ClubUpdateInput = z.infer<typeof ClubUpdateInput>;

export const ClubsList = z.object({
  items: z.array(Club),
  nextCursor: z.string().nullable(),
});
export type ClubsList = z.infer<typeof ClubsList>;

export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z
      .array(z.object({ field: z.string(), message: z.string() }))
      .optional(),
    traceId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

export const UploadSignRequest = z.object({
  filename: z.string().min(1).max(256),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().min(1).max(8 * 1024 * 1024),
});
export type UploadSignRequest = z.infer<typeof UploadSignRequest>;

export const UploadSignResponse = z.object({
  url: z.string().url(),
  key: z.string(),
  expiresAt: z.string().datetime({ offset: true }),
});
export type UploadSignResponse = z.infer<typeof UploadSignResponse>;

export const SessionUser = z.object({
  telegramUserId: z.number().int(),
  isAdmin: z.boolean(),
  firstName: z.string().nullable(),
  username: z.string().nullable(),
});
export type SessionUser = z.infer<typeof SessionUser>;
