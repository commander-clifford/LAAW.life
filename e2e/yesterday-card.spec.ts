import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { addDaysToDateKey, getDateKey } from "../src/application/calendar-dates";
import type { CalendarAgenda } from "../src/application/ports";

const agendas = JSON.parse(readFileSync(new URL("../.calendar-data/agendas.json", import.meta.url), "utf8")) as Record<string, CalendarAgenda>;
const agenda = agendas["ivy-station"];
const now = new Date(agenda.generatedAt);
const today = getDateKey(now, agenda.timeZone);

test.use({ timezoneId: "Asia/Tokyo" });

for (const width of [393, 1440]) for (const appearance of ["light", "dark"] as const) {
  test(`Yesterday precedes default Today with orange focus and stable indicators at ${width}px ${appearance}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: appearance, reducedMotion: "no-preference" });
    await page.clock.setFixedTime(now);
    await page.goto("ivy/");
    const carousel = page.getByRole("region", { name: "Daily schedule", exact: true });
    const viewport = page.getByRole("group", { name: "Day cards", exact: true });
    const active = carousel.locator("[data-day-card][data-active='true']");
    await expect(carousel).toHaveAttribute("data-active-index", "1");
    await expect(active.locator("time").first()).toHaveAttribute("datetime", today);
    await expect(carousel.locator("[data-day-card]")).toHaveCount(8);
    await viewport.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(carousel).toHaveAttribute("data-active-index", "0");
    await expect(active.locator("time").first()).toHaveAttribute("datetime", addDaysToDateKey(today, -1));
    await expect(active.locator(".day-card-relative-label")).toHaveText("Yesterday");
    await expect.poll(() => active.evaluate(element => {
      const view = element.closest(".day-carousel-viewport")!.getBoundingClientRect();
      return Math.abs(element.getBoundingClientRect().left - view.left);
    })).toBeLessThan(1);
    const frame = await active.evaluate(element => {
      const style = getComputedStyle(element, "::after");
      return { color: style.borderTopColor, width: style.borderTopWidth, separator: style.boxShadow };
    });
    expect(frame.color).toBe("rgb(237, 85, 55)");
    expect(frame.width).toBe("2px");
    expect(frame.separator).toContain(appearance === "dark" ? "rgb(13, 13, 13)" : "rgb(25, 25, 25)");
    const selectedDot = carousel.locator(".day-carousel-dot[aria-current='true'] > span");
    const otherDot = carousel.getByRole("button", { name: "Go to Today", exact: true }).locator("span");
    await expect(selectedDot).toHaveCSS("background-color", "rgb(237, 85, 55)");
    await expect(selectedDot).toHaveCSS("width", "24px");
    await expect(selectedDot).toHaveCSS("height", "6px");
    await expect(selectedDot).toHaveCSS("opacity", "1");
    await expect(otherDot).toHaveCSS("background-color", "rgb(203, 51, 21)");
    await expect(otherDot).toHaveCSS("width", "6px");
    await expect(otherDot).toHaveCSS("opacity", "0.72");
    await expect(otherDot).toHaveCSS("transition-duration", "0.16s, 0.16s, 0.16s");
    await expect(otherDot).toHaveCSS("transition-property", "width, height, opacity");
    await expect(otherDot).toHaveCSS("transition-timing-function", "ease, ease, ease");
    await page.keyboard.press("ArrowLeft");
    await expect(carousel).toHaveAttribute("data-active-index", "0");
    await page.getByRole("button", { name: /^Return to Today/ }).click();
    await expect(carousel).toHaveAttribute("data-active-index", "1");
    await expect(viewport).toBeFocused();
    await expect(active.locator("time").first()).toHaveAttribute("datetime", today);
    await page.keyboard.press("ArrowRight");
    await expect(carousel).toHaveAttribute("data-active-index", "2");
    await expect(active.locator(".day-card-relative-label")).toHaveText("Tomorrow");
    await page.reload();
    await expect(carousel).toHaveAttribute("data-active-index", "1");
    await expect(active.locator("time").first()).toHaveAttribute("datetime", today);
    expect(await page.locator(".calendar-source-dot").evaluateAll(elements => elements.every(element => getComputedStyle(element).display === "none"))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("midnight preserves a browsed future date and returning to Today follows the next rollover", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: now });
  await page.goto("ivy/");
  const carousel = page.getByRole("region", { name: "Daily schedule", exact: true });
  const date = carousel.locator("[data-day-card][data-active='true'] .day-card-date time");
  await page.getByRole("button", { name: "Go to In 3 days", exact: true }).click();
  const selected = addDaysToDateKey(today, 3);
  await expect(date).toHaveAttribute("datetime", selected);
  await page.clock.setSystemTime(new Date(`${addDaysToDateKey(today, 1)}T19:00:00Z`));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.clock.runFor(100);
  await expect(date).toHaveAttribute("datetime", selected);
  await expect(carousel).toHaveAttribute("data-active-index", "3");
  await page.getByRole("button", { name: /^Return to Today/ }).click();
  await expect(date).toHaveAttribute("datetime", addDaysToDateKey(today, 1));
  await page.clock.setSystemTime(new Date(`${addDaysToDateKey(today, 2)}T19:00:00Z`));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.clock.runFor(100);
  await expect(date).toHaveAttribute("datetime", addDaysToDateKey(today, 2));
  await expect(carousel).toHaveAttribute("data-active-index", "1");
});
