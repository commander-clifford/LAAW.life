import { expect, test } from "@playwright/test";

test("search finds current downloaded events and clears using the keyboard", async ({ page }) => {
  await page.goto("/ivy/");
  const input = page.getByRole("searchbox", { name: "Event title or details" });
  await expect(input).toBeVisible();
  await input.fill("not-an-event-6cc782");
  await expect(page.getByText("0 matching events.")).toBeVisible();
  await expect(page.getByText(/No events match/)).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByText("Results appear as you type.")).toBeVisible();
});

for (const width of [390, 1280]) {
  test(`search covers historical/future descriptions and paginates at ${width}px`, async ({ page }) => {
    const { readFileSync } = await import("node:fs");
    const agendas = JSON.parse(readFileSync(new URL("../.calendar-data/agendas.json", import.meta.url), "utf8"));
    const source = agendas["ivy-station"];
    const generatedAt = new Date(Date.parse(source.generatedAt) + 1000).toISOString();
    await page.clock.setFixedTime(new Date(Date.parse(source.generatedAt) + 2000));
    await page.setViewportSize({ width, height: 900 });
    const dates = [source.availableDateKeys[0], source.availableDateKeys.at(-1)];
    const events = Array.from({ length: 70 }, (_, index) => ({
      id: `fixture-${index}`, allDay: true, title: `Watch party ${index + 1}`,
      description: `Seahawks football club <img src=x onerror=alert(1)>`, location: "Community room", sourceName: "Search fixture",
      start: `${dates[index % 2]}T19:00:00.000Z`, end: `${dates[index % 2]}T20:00:00.000Z`, dateKeys: [dates[index % 2]],
    }));
    await page.route("**/calendar-data/agendas.json", route => route.fulfill({ json: { ...agendas, "ivy-station": { ...source, generatedAt, events } } }));
    await page.goto("ivy/");
    const input = page.getByRole("searchbox", { name: "Event title or details" });
    await input.fill("SEAHAWKS football");
    await expect(page.getByText("70 matching events.")).toBeVisible();
    const results = page.locator("section[aria-labelledby]").filter({ has: input }).locator("ol > li");
    await expect(results).toHaveCount(50);
    await page.getByRole("button", { name: /Show more events/ }).click();
    await expect(results).toHaveCount(70);
    await results.first().getByText("Event details").click();
    await expect(results.first().getByText(/<img src=x/)).toBeVisible();
    await expect(results.locator("img")).toHaveCount(0);
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("");
  });
}

for (const width of [320, 393, 600, 1440]) {
  test(`search shares the location and active-card side margins at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("ivy/");
    await page.locator('.day-carousel[aria-busy="false"]').waitFor();
    const heading = await page.locator('.location-heading-section').boundingBox();
    const card = await page.locator('[data-day-card][data-active="true"]').boundingBox();
    const search = await page.locator('section').filter({ has: page.getByRole('searchbox') }).boundingBox();
    const disclosure = await page.locator('.calendar-disclosure').boundingBox();
    for (const box of [search, disclosure, heading]) {
      expect(Math.abs(box!.x - card!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(box!.width - card!.width)).toBeLessThanOrEqual(1);
    }
  });
}
