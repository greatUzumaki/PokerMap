import { describe, expect, it } from "vitest";

function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

describe("pluralize ru", () => {
  const f: [string, string, string] = ["клуб", "клуба", "клубов"];
  it.each([
    [1, "клуб"],
    [2, "клуба"],
    [4, "клуба"],
    [5, "клубов"],
    [11, "клубов"],
    [21, "клуб"],
    [22, "клуба"],
    [25, "клубов"],
  ])("%i -> %s", (n, expected) => {
    expect(pluralize(n, f)).toBe(expected);
  });
});
