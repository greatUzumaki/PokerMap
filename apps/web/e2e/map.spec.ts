import { test, expect } from "@playwright/test";

test("map renders tiles on first paint at desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  const tileResponses: number[] = [];
  page.on("response", (res) => {
    const url = res.url();
    if (/\/\d+\/\d+\/\d+(@2x)?\.(png|jpg|webp)/i.test(url)) {
      tileResponses.push(res.status());
    }
  });

  await page.goto("/");

  const canvas = page.locator("canvas.maplibregl-canvas");
  await canvas.waitFor({ state: "attached", timeout: 5000 });
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(800);
  expect(box?.height ?? 0).toBeGreaterThan(300);

  // Allow tiles to load.
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  expect(tileResponses.length).toBeGreaterThan(0);
  expect(tileResponses.every((s) => s < 400)).toBe(true);
});

test("loading fallback disappears within 3s", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByText("Загружаем карту…")).toHaveCount(0, { timeout: 3000 });
});
