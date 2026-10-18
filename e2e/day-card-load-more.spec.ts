import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { addDaysToDateKey } from "../src/application/calendar-dates";
import type { CalendarAgenda } from "../src/application/ports";

const agendas = JSON.parse(readFileSync(new URL("../.calendar-data/agendas.json", import.meta.url), "utf8")) as Record<string, CalendarAgenda>;
const today = agendas["ivy-station"].initialDateKey;

for (const width of [320, 393, 1440]) {
  test(`a borderless card adds full weeks and preserves navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: width < 600 ? "reduce" : "no-preference" });
    await page.clock.setFixedTime(new Date(`${today}T19:00:00Z`));
    await page.goto("ivy/");
    const carousel = page.locator(".day-carousel");
    const cards = carousel.locator("[data-day-card]");
    const moreCard = carousel.locator(".day-card-more");
    const viewport = carousel.locator(".day-carousel-viewport");
    await expect(cards).toHaveCount(7);
    await expect(moreCard).toHaveCount(1);
    await expect(carousel.locator("[data-carousel-item]")).toHaveCount(8);
    await expect(moreCard).toHaveCSS("border-top-width", "0px");
    await expect(moreCard).toHaveCSS("box-shadow", "none");
    await expect(moreCard.locator("header, h2, .day-card-heading")).toHaveCount(0);
    const original = (await cards.first().boundingBox())!;
    const more = (await moreCard.boundingBox())!;
    expect(more.width).toBeCloseTo(original.width, 0);
    expect(more.height).toBeCloseTo(original.height, 0);
    const button = carousel.getByRole("button", { name: "Load seven more days", exact: true });
    await carousel.getByRole("button", { name: "Go to load more days", exact: true }).click();
    await expect(carousel).toHaveAttribute("data-active-index", "7");
    await expect(button).toHaveClass(/day-card-more/);
    await expect(button.locator("button, a, input, select")).toHaveCount(0);
    await expect.poll(async () => moreCard.evaluate(element => {
      const card = element.getBoundingClientRect();
      const label = element.querySelector(".day-card-load-more-label")!.getBoundingClientRect();
      return Math.max(Math.abs(card.x + card.width / 2 - label.x - label.width / 2), Math.abs(card.y + card.height / 2 - label.y - label.height / 2));
    })).toBeLessThanOrEqual(1);
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(cards).toHaveCount(14);
    await expect(carousel.locator("[data-carousel-item]")).toHaveCount(15);
    await expect(carousel).toHaveAttribute("data-active-index", "7");
    await expect(viewport).toBeFocused();
    expect(await cards.locator(".day-card-date time").evaluateAll(elements => elements.map(element => element.getAttribute("datetime")))).toEqual(
      Array.from({ length: 14 }, (_, index) => addDaysToDateKey(today, index)),
    );
    await expect(carousel.locator("[aria-live='polite']")).toHaveText("Showing In 7 days, day 8 of 14.");
    await page.keyboard.press("ArrowLeft");
    await expect(carousel).toHaveAttribute("data-active-index", "6");
    await page.keyboard.press("ArrowRight");
    await expect(carousel).toHaveAttribute("data-active-index", "7");
    await page.getByRole("button", { name: /^Return to Today/ }).click();
    await expect(carousel).toHaveAttribute("data-active-index", "0");
    await expect(cards).toHaveCount(14);
    for (const total of [21, 28, 35]) {
      await carousel.getByRole("button", { name: "Go to load more days", exact: true }).click();
      if (total === 21) {
        await button.click({ position: { x: 4, y: 4 } });
      } else if (total === 28) {
        const bounds = (await button.boundingBox())!;
        await button.click({ position: { x: bounds.width - 4, y: bounds.height - 4 } });
      } else {
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("ArrowRight");
        await expect(button).toBeFocused();
        await page.keyboard.press("Space");
      }
      await expect(cards).toHaveCount(total);
      await expect(carousel).toHaveAttribute("data-active-index", String(total - 7));
    }
    await expect(moreCard).toHaveCount(0);
    await expect(carousel.locator("[data-carousel-item]")).toHaveCount(35);
    await carousel.getByRole("button", { name: "Go to In 34 days", exact: true }).click();
    await viewport.focus();
    await page.keyboard.press("ArrowRight");
    await expect(carousel).toHaveAttribute("data-active-index", "34");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

for (const coverage of [13, 14]) {
  test(`load-more requires a complete next week with ${coverage} known dates`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(agendas["ivy-station"].generatedAt));
    const refreshed = { ...agendas, "ivy-station": {
      ...agendas["ivy-station"], generatedAt: new Date(Date.parse(agendas["ivy-station"].generatedAt) + 1).toISOString(),
      availableDateKeys: Array.from({ length: coverage }, (_, index) => addDaysToDateKey(today, index)),
      events: agendas["ivy-station"].events.filter(event => event.dateKeys.every(date => date >= today && date <= addDaysToDateKey(today, coverage - 1))),
    } };
    await page.route("**/calendar-data/agendas.json*", route => route.fulfill({ json: refreshed }));
    await page.goto("ivy/");
    const carousel = page.locator(".day-carousel");
    await expect(carousel.locator("[data-day-card]")).toHaveCount(7);
    const dateLabel = (dateKey: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" })
      .format(new Date(`${dateKey}T12:00:00Z`));
    await expect(page.locator('p[id$="-range"]')).toHaveText(
      `Search past and upcoming events from ${dateLabel(today)} through ${dateLabel(addDaysToDateKey(today, coverage - 1))}.`,
    );
    if (coverage === 13) {
      await expect(carousel.locator(".day-card-more")).toHaveCount(0);
    } else {
      await carousel.getByRole("button", { name: "Go to load more days", exact: true }).click();
      await carousel.getByRole("button", { name: "Load seven more days", exact: true }).click();
      await expect(carousel.locator("[data-day-card]")).toHaveCount(14);
      await expect(carousel.locator(".day-card-more")).toHaveCount(0);
    }
  });
}
