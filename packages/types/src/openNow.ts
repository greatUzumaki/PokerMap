import type { DayKey, WorkingHours } from "./zod";
import { DAY_KEYS } from "./zod";

type WallClock = { dayKey: DayKey; minutes: number };

function toWallClock(now: Date, tz: string): WallClock {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  let weekday = "";
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === "weekday") weekday = p.value;
    else if (p.type === "hour") hour = parseInt(p.value, 10) % 24;
    else if (p.type === "minute") minute = parseInt(p.value, 10);
  }
  const map: Record<string, DayKey> = {
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
    Sun: "sun",
  };
  const dayKey: DayKey | undefined = map[weekday];
  if (!dayKey) throw new Error(`unrecognized weekday from Intl: ${weekday}`);
  return { dayKey, minutes: hour * 60 + minute };
}

function parseHHMM(value: string): number {
  const [h, m] = value.split(":");
  return parseInt(h ?? "0", 10) * 60 + parseInt(m ?? "0", 10);
}

function prevDay(d: DayKey): DayKey {
  const idx = DAY_KEYS.indexOf(d);
  const i = (idx + DAY_KEYS.length - 1) % DAY_KEYS.length;
  return DAY_KEYS[i] as DayKey;
}

export function isOpenNow(hours: WorkingHours, now: Date, tz = "Europe/Moscow"): boolean {
  const { dayKey, minutes } = toWallClock(now, tz);
  const today = hours[dayKey];
  if (!today.closed) {
    for (const slot of today.slots) {
      const open = parseHHMM(slot.open);
      const close = parseHHMM(slot.close);
      if (close > open) {
        if (minutes >= open && minutes < close) return true;
      } else {
        if (minutes >= open) return true;
      }
    }
  }
  const yesterday = hours[prevDay(dayKey)];
  if (yesterday.closed) return false;
  for (const slot of yesterday.slots) {
    const open = parseHHMM(slot.open);
    const close = parseHHMM(slot.close);
    if (close <= open && minutes < close) return true;
  }
  return false;
}
