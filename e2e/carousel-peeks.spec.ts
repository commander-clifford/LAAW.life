import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { addDaysToDateKey, getDateKey } from "../src/application/calendar-dates";
import type { CalendarAgenda } from "../src/application/ports";

const agendas = JSON.parse(readFileSync(new URL("../.calendar-data/agendas.json", import.meta.url), "utf8")) as Record<string, CalendarAgenda>;
const agenda = agendas["ivy-station"];
const now = new Date(agenda.generatedAt);
const today = getDateKey(now, agenda.timeZone);

test.use({ timezoneId: "Asia/Tokyo" });

for (const width of [320, 393, 1440]) for (const appearance of ["light", "dark"] as const) {
  test(`existing previous and next cards peek around the selected day at ${width}px ${appearance}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: appearance, reducedMotion: "reduce" });
    await page.clock.setFixedTime(now);
    await page.goto("ivy/");
    const carousel = page.getByRole("region", { name: "Seven-day schedule", exact: true });
    const viewport = page.getByRole("group", { name: "Day cards", exact: true });
    const cards = carousel.locator("[data-day-card]");
    await expect(carousel).toHaveAttribute("data-active-index", "0");
    await expect(cards).toHaveCount(7);
    await expect(carousel.getByRole("button", { name: "Go to Yesterday", exact: true })).toHaveCount(0);
    expect(await cards.locator(".day-card-date time").evaluateAll(elements => elements.map(element => element.getAttribute("datetime")))).toEqual(
      Array.from({ length: 7 }, (_, index) => addDaysToDateKey(today, index)),
    );
    const inspect = async (index: number) => {
      await expect(carousel).toHaveAttribute("data-active-index", String(index));
      const geometry = await viewport.evaluate(element => {
        const rail = element.getBoundingClientRect();
        const all = [...element.querySelectorAll("[data-day-card]")];
        const active = element.querySelector("[data-day-card][data-active='true']")!.getBoundingClientRect();
        const heading = document.querySelector(".location-heading-section")!.getBoundingClientRect();
        return {
          centered: Math.abs(active.x + active.width / 2 - rail.x - rail.width / 2),
          headingAlignment: Math.abs(active.x - heading.x),
          visible: all.map(card => { const box = card.getBoundingClientRect(); return Math.max(0, Math.min(box.right, rail.right) - Math.max(box.left, rail.left)); }),
        };
      });
      expect(geometry.centered).toBeLessThanOrEqual(1);
      expect(geometry.headingAlignment).toBeLessThanOrEqual(1);
      if (index > 0) {
        expect(geometry.visible[index - 1]).toBeGreaterThanOrEqual(8);
        expect(geometry.visible[index - 1]).toBeLessThanOrEqual(24);
      }
      if (index < 6) expect(geometry.visible[index + 1]).toBeGreaterThanOrEqual(8);
      for (const [cardIndex, visible] of geometry.visible.entries()) {
        if (Math.abs(cardIndex - index) > 1) expect(visible).toBeLessThan(1);
      }
    };
    await inspect(0);
    await viewport.focus();
    await page.keyboard.press("ArrowLeft");
    await inspect(0);
    await page.keyboard.press("ArrowRight");
    await inspect(1);
    await expect(cards.nth(1).locator(".day-card-relative-label")).toHaveText("Tomorrow");
    expect(await cards.nth(1).evaluate(element => getComputedStyle(element, "::after").borderTopColor)).toBe("rgb(237, 85, 55)");
    await carousel.getByRole("button", { name: "Go to In 3 days", exact: true }).click();
    await inspect(3);
    await page.getByRole("button", { name: /^Return to Today/ }).click();
    await inspect(0);
    const input = page.getByRole("searchbox", { name: "Search events", exact: true });
    await expect(input).toHaveCSS("border-top-width", "0px");
    await expect(input).toHaveCSS("background-color", appearance === "dark" ? "rgb(77, 77, 77)" : "rgb(255, 255, 255)");
    await expect(carousel.locator(".day-carousel-dot[aria-current='true'] span")).toHaveCSS("background-color", appearance === "dark" ? "rgb(227, 227, 227)" : "rgb(17, 17, 17)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
