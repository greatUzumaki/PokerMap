import { test, expect } from "@playwright/test";

test("home loads and shows map container", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: /основная навигация/i })).toBeVisible();
});

test("admin returns 404 outside Telegram", async ({ page }) => {
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
});
