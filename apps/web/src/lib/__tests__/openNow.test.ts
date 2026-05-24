import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isOpenNow, type WorkingHours } from "@pokermap/types";

type Case = {
  name: string;
  hours: WorkingHours;
  now: string;
  tz: string;
  expected: boolean;
};

const fixture = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "../../../../../packages/types/test-fixtures/working-hours-cases.json"),
    "utf8",
  ),
) as Case[];

describe("isOpenNow (shared fixture)", () => {
  for (const c of fixture) {
    it(c.name, () => {
      expect(isOpenNow(c.hours, new Date(c.now), c.tz)).toBe(c.expected);
    });
  }
});

describe("isOpenNow boundaries", () => {
  const hours: WorkingHours = {
    mon: { closed: false, slots: [{ open: "12:00", close: "20:00" }] },
    tue: { closed: true, slots: [] },
    wed: { closed: true, slots: [] },
    thu: { closed: true, slots: [] },
    fri: { closed: true, slots: [] },
    sat: { closed: true, slots: [] },
    sun: { closed: true, slots: [] },
  };

  it("12:00 Moscow exactly is open (inclusive)", () => {
    expect(isOpenNow(hours, new Date("2026-05-25T09:00:00Z"), "Europe/Moscow")).toBe(true);
  });

  it("20:00 Moscow exactly is closed (exclusive)", () => {
    expect(isOpenNow(hours, new Date("2026-05-25T17:00:00Z"), "Europe/Moscow")).toBe(false);
  });

  it("19:59 Moscow is still open", () => {
    expect(isOpenNow(hours, new Date("2026-05-25T16:59:00Z"), "Europe/Moscow")).toBe(true);
  });
});
