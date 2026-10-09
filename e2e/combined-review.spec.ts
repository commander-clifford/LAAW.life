import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { CalendarAgenda } from "../src/application/ports";

const reviewComparison = process.env.PLAYWRIGHT_REVIEW_PREVIEW === "true";

const agendas = JSON.parse(readFileSync(new URL("../.calendar-data/agendas.json", import.meta.url), "utf8")) as Record<string, CalendarAgenda>;
const source = agendas["ivy-station"];
const now = Math.max(Date.parse(`${source.initialDateKey}T19:00:00Z`), Date.parse(source.generatedAt) + 2000);
const screenshotDirectory = process.env.REVIEW_SCREENSHOT_DIR;
async function capture(page: Page, name: string) {
  await expect.poll(async () => page.locator('.day-card[data-active="true"]').evaluate(element => {
    const viewport = element.closest('.day-carousel-viewport')!.getBoundingClientRect();
    const card = element.getBoundingClientRect();
    return Math.abs(card.x + card.width / 2 - viewport.x - viewport.width / 2);
  })).toBeLessThanOrEqual(1);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, name), fullPage: false });
}

for (const width of [393, 1280]) {
  test(`combined changes keep current date controls, row toggles and search working after loading a week at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
    await page.clock.setFixedTime(new Date(now));
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("ivy/?eventLayout=title-first");
    await expect(page.locator(".event-row-prototype-controls")).toHaveCount(reviewComparison ? 1 : 0);
    const carousel = page.locator(".day-carousel");
    const cards = carousel.locator("[data-day-card]");
    const layer = page.locator(".location-today-control");
    await expect(cards).toHaveCount(7);
    await expect(layer).toHaveAttribute("data-scroll-progress", /^0(?:\.0+)?$/);
    await expect(page.locator(".event-row-prototype")).toHaveAttribute("data-event-layout", "title-first");
    const initial = (await cards.first().boundingBox())!;
    if (width === 393) await capture(page, "candidate-today.png");
    else await capture(page, "candidate-desktop.png");
    await carousel.getByRole("button", { name: "Go to load more days", exact: true }).click();
    const more = carousel.locator(".day-card-more");
    await expect(carousel).toHaveAttribute("data-active-index", "7");
    await expect(more).toHaveCSS("border-top-width", "0px");
    const moreBox = (await more.boundingBox())!;
    expect(moreBox.width).toBeCloseTo(initial.width, 0);
    expect(moreBox.height).toBeCloseTo(initial.height, 0);
    if (width === 393) await capture(page, "candidate-load-more.png");
    await more.click();
    await expect(cards).toHaveCount(14);
    await expect(layer).toHaveAttribute("data-scroll-progress", /^1(?:\.0+)?$/);
    if (width === 393) await capture(page, "candidate-fourteen-days.png");
    await page.getByRole("button", { name: /^Return to Today/ }).click();
    await expect(carousel).toHaveAttribute("data-active-index", "0");
    await expect(layer).toHaveAttribute("data-scroll-progress", /^0(?:\.0+)?$/);
    const input = page.getByRole("searchbox", { name: "Search events" });
    await input.fill("trivia");
    await expect(page.getByText(/\d+ matching events\./)).toBeVisible();
    await expect(page.locator("section").filter({ has: input }).locator("ol > li")).not.toHaveCount(0);
    if (width === 393 && screenshotDirectory) {
      await page.screenshot({ path: join(screenshotDirectory, "candidate-search.png"), fullPage: false });
    }
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(input).toBeFocused();
    if (reviewComparison) {
    await page.getByRole("button", { name: "Preview controls", exact: true }).click();
    await page.getByRole("button", { name: "Current: time first" }).click();
    await expect(cards).toHaveCount(14);
    await expect(layer).toHaveAttribute("data-scroll-progress", /^0(?:\.0+)?$/);
    if (width === 393) {
      await page.getByRole("button", { name: "Hide preview controls", exact: true }).click();
      await capture(page, "candidate-current-rows.png");
      await page.getByRole("button", { name: "Preview controls", exact: true }).click();
    }
    await page.getByRole("button", { name: "Proposed: title first" }).click();
    await page.getByRole("button", { name: "Hide preview controls", exact: true }).click();
    } else await expect(page.locator(".event-row-prototype-controls")).toHaveCount(0);
    if (width === 393) await capture(page, "candidate-title-first-rows.png");
    await carousel.getByRole("button", { name: "Go to Tomorrow", exact: true }).click();
    await expect(layer).toHaveAttribute("data-scroll-progress", /^1(?:\.0+)?$/);
    await expect(page.locator(".location-today-control")).toHaveCSS("opacity", "1");
    if (width === 393) await capture(page, "candidate-date-header.png");
    await page.getByRole("button", { name: /^Return to Today/ }).click();
    await expect(layer).toHaveAttribute("data-scroll-progress", /^0(?:\.0+)?$/);
    const card = (await cards.first().boundingBox())!;
    for (const locator of [page.locator(".location-heading-section"), page.locator("section").filter({ has: input }), page.locator(".calendar-disclosure")]) {
      const bounds = (await locator.boundingBox())!;
      expect(Math.abs(bounds.x - card.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(bounds.width - card.width)).toBeLessThanOrEqual(1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

for (const theme of ["trivia", "bingo"] as const) {
  test(`combined preview renders the ${theme} review example with approved rows and current motion`, async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 900 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.clock.setFixedTime(new Date(now));
    const example = {
      id: `review-example-${theme}`, title: theme === "trivia" ? "Lucky Guess Trivia" : "Thrift Store Bingo",
      allDay: false, start: `${source.initialDateKey}T19:00:00.000Z`, end: `${source.initialDateKey}T20:00:00.000Z`,
      dateKeys: [source.initialDateKey], location: null, sourceName: "Deterministic review example",
      metadata: { tags: [theme], takeover: { enabled: true, theme, priority: 1000 } },
    };
    await page.route("**/calendar-data/agendas.json", route => route.fulfill({ json: { ...agendas, "ivy-station": {
      ...source, generatedAt: new Date(now - 1000).toISOString(), events: [...source.events, example],
    } } }));
    await page.goto("ivy/?eventLayout=title-first");
    await expect(page.locator("[data-day-card]").first()).toHaveAttribute("data-event-theme", theme);
    await capture(page, `candidate-theme-${theme}.png`);
  });
}

test("combined preview keeps calendar recovery available alongside the carousel and search", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 900 });
  await page.clock.setFixedTime(new Date(now));
  await page.route("https://calendar.google.com/**", () => new Promise(() => undefined));
  await page.goto("ivy/?eventLayout=title-first");
  await page.getByRole("button", { name: "Open calendar", exact: true }).click();
  const shell = page.locator(".calendar-shell");
  await expect(shell).toHaveAttribute("data-calendar-status", "loading");
  await expect(page.getByRole("button", { name: "Reload calendar", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in Google Calendar", exact: true })).toBeVisible();
  if (screenshotDirectory) await shell.screenshot({ path: join(screenshotDirectory, "candidate-calendar-loading.png") });
  await shell.locator("iframe").evaluate(element => element.dispatchEvent(new Event("error")));
  await expect(shell).toHaveAttribute("data-calendar-status", "error");
  if (screenshotDirectory) await shell.screenshot({ path: join(screenshotDirectory, "candidate-calendar-recovery.png") });
  await page.getByRole("button", { name: "Reload calendar", exact: true }).click();
  await expect(shell).toHaveAttribute("data-calendar-status", "loading");
  await expect(page.getByRole("searchbox", { name: "Search events" })).toBeVisible();
});
