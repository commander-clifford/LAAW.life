import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const agendas = JSON.parse(readFileSync(new URL("../.calendar-data/agendas.json", import.meta.url), "utf8"));

for (const width of [320, 1440]) {
  test(`title-first prototype preserves busy-day scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const source = agendas.hawthorne;
    const clock = new Date(Date.parse(source.generatedAt) + 2000);
    await page.clock.setFixedTime(clock);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: source.timeZone }).format(clock);
    const tomorrow = new Date(`${today}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const dateKey = tomorrow.toISOString().slice(0, 10);
    const events = Array.from({ length: 8 }, (_, index) => ({
      allDay: index === 0, dateKeys: [dateKey], id: `busy-${index}`, location: null, sourceName: "Design fixture",
      start: `${dateKey}T22:00:00.000Z`, end: `${dateKey}T23:00:00.000Z`,
      title: index < 3 ? `Event ${index + 1}` : "Hawthorne neighborhood food truck and football club watch party",
    }));
    await page.route("**/calendar-data/agendas.json", route => route.fulfill({ json: { ...agendas, hawthorne: { ...source, generatedAt: new Date(clock.getTime() - 1000).toISOString(), events } } }));
    await page.goto("hawthorne/?eventLayout=title-first");
    await expect(page.getByRole("button", { name: "Proposed: title first" })).toHaveAttribute("aria-pressed", "true");
    await page.locator(".day-carousel-dot").nth(1).click();
    const card = page.locator('[data-day-card][data-active="true"]');
    const schedule = card.locator(".day-card-schedule");
    await expect(schedule).toHaveAttribute("data-overflow", "true");
    const heights = await page.locator('[data-day-card]').evaluateAll(elements => elements.map(e => e.getBoundingClientRect().height));
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    const boxes = await card.locator(".day-card-event").evaluateAll(rows => rows.map(row => {
      const title = row.querySelector("h3")!.getBoundingClientRect();
      const time = row.querySelector("time")!.getBoundingClientRect();
      const bounds = row.getBoundingClientRect();
      return { titleRight: title.right, timeLeft: time.left, timeRight: time.right, right: bounds.right };
    }));
    for (const box of boxes) {
      expect(box.titleRight).toBeLessThanOrEqual(box.timeLeft);
      expect(box.timeRight).toBeLessThanOrEqual(box.right + 1);
    }
    const frame = card.locator(".day-card-schedule-frame");
    await expect(frame.locator(".day-card-schedule-fade-bottom")).toHaveCSS("opacity", "1");
    await schedule.evaluate(element => { element.scrollTop = 80; });
    await expect(frame.locator(".day-card-schedule-fade-top")).toHaveCSS("opacity", "1");
    await schedule.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(frame.locator(".day-card-schedule-fade-bottom")).toHaveCSS("opacity", "0");
    await page.getByRole("button", { name: "Current: time first" }).click();
    await expect(page.getByRole("button", { name: "Current: time first" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".day-carousel")).toHaveAttribute("data-active-index", "1");
    await page.getByRole("button", { name: "Proposed: title first" }).click();
    const viewport = page.locator('.day-carousel-viewport');
    await viewport.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.day-carousel')).toHaveAttribute('data-active-index', '2');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.day-carousel')).toHaveAttribute('data-active-index', '1');
    if (width === 1440) {
      await page.getByRole('button', { name: 'Next day', exact: true }).click();
      await expect(page.locator('.day-carousel')).toHaveAttribute('data-active-index', '2');
      await page.getByRole('button', { name: 'Previous day', exact: true }).click();
      await expect(page.locator('.day-carousel')).toHaveAttribute('data-active-index', '1');
    }
    await page.goto("ivy/?eventLayout=title-first");
    await expect(page.locator('[data-day-card]')).toHaveCount(7);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
