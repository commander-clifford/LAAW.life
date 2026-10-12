import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import type { CalendarAgenda, CalendarAgendaItem } from "../src/application/ports";
import { laawLifeTenant } from "../src/config/laaw-life";
import { parseGoogleCalendarEmbed } from "../src/infrastructure/google-calendar-source";

const agendas = JSON.parse(readFileSync(
  new URL("../.calendar-data/agendas.json", import.meta.url), "utf8",
)) as Record<string, CalendarAgenda>;
const source = agendas.hawthorne;
const sources = parseGoogleCalendarEmbed(laawLifeTenant.locations[1].calendar.src).calendarSources;
const calendarFixtures = [
  { id: sources[0].calendarId, name: "Hawthorne Calendar", title: "Community event" },
  { id: sources[2].calendarId, name: "Los Angeles Football Club", title: "Football fixture with a long title that wraps on a narrow Day Card" },
  { id: sources[3].calendarId, name: "Los Angeles Galaxy", title: "Galaxy fixture" },
  { id: sources[7].calendarId, name: "Holidays in United States", title: "Public holiday fixture" },
];
const generatedAt = new Date(Date.parse(source.generatedAt) + 1000).toISOString();
const now = new Date(Date.parse(source.generatedAt) + 2000);
function rgb(color: string | undefined): string {
  if (!color) throw new Error("Calendar color fixture is missing its configured color.");
  return `rgb(${[1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16)).join(", ")})`;
}
const events: CalendarAgendaItem[] = calendarFixtures.map((calendar, index) => ({
  allDay: true,
  dateKeys: [source.initialDateKey],
  end: `${source.initialDateKey}T20:00:00.000Z`,
  id: `color-fixture-${index}`,
  location: null,
  sourceColor: sources.find(({ calendarId }) => calendarId === calendar.id)?.color,
  sourceName: calendar.name,
  start: `${source.initialDateKey}T19:00:00.000Z`,
  title: calendar.title,
}));

test.use({ timezoneId: "Asia/Tokyo", reducedMotion: "reduce" });

for (const width of [320, 1280]) {
  for (const appearance of ["light", "dark"] as const) {
    test(`configured colors supplement source names at ${width}px in ${appearance}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: appearance });
      await page.clock.setFixedTime(now);
      await page.route("**/calendar-data/agendas.json", route => route.fulfill({
        json: { ...agendas, hawthorne: { ...source, generatedAt, events } },
      }));
      await page.goto("hawthorne/");
      const card = page.locator("[data-day-card][data-active='true']");
      await expect(card.locator("h3")).toHaveText(events.map(event => event.title));
      await expect(card.locator(".day-card-event-source-dot")).toHaveCount(4);
      for (const [index, event] of events.entries()) {
        const row = card.locator(".day-card-event").nth(index);
        await expect(row.locator(".day-card-event-source-dot")).toHaveAttribute("aria-hidden", "true");
        await expect(row.locator(".day-card-event-source-dot")).toHaveCSS("background-color", rgb(event.sourceColor));
        await expect(row.getByText(`Calendar: ${event.sourceName}.`, { exact: true })).toHaveCount(1);
        await expect(row.locator("time > [aria-hidden]")).toHaveText("All day");
      }
      expect(await card.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      const firstCardDate = await card.locator(".day-card-date time").getAttribute("datetime");
      await page.getByRole("button", { name: "Go to Tomorrow", exact: true }).click();
      await expect(page.locator(".day-carousel")).toHaveAttribute("data-active-index", "1");
      await page.getByRole("button", { name: "Go to Today", exact: true }).click();
      await expect(card.locator(".day-card-date time")).toHaveAttribute("datetime", firstCardDate!);

      const legend = page.locator("[data-calendar-source-legend]");
      await legend.locator("summary").focus();
      await legend.locator("summary").press("Enter");
      await expect(legend).toHaveAttribute("open", "");
      await expect(legend.locator("li")).toHaveCount(4);
      for (const event of events) {
        await expect(legend.getByText(event.sourceName, { exact: true })).toBeVisible();
      }

      await page.getByRole("searchbox", { name: "Search events" }).fill("fixture");
      const results = page.getByRole("list", { name: "Matching calendar events" }).locator("li");
      await expect(results).toHaveCount(3);
      await expect(results.locator("h3 > span[aria-hidden='true']")).toHaveCount(3);
      for (const [index, event] of events.slice(1).entries()) {
        await expect(results.nth(index).locator("h3 > span[aria-hidden='true']")).toHaveCSS("background-color", rgb(event.sourceColor));
        await expect(results.nth(index).getByText(event.sourceName, { exact: true })).toBeVisible();
      }
      const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(audit.violations).toEqual([]);
      await page.emulateMedia({ forcedColors: "active" });
      await expect(card.locator(".day-card-event-source-dot").first()).toBeHidden();
      await expect(card.getByText(`Calendar: ${events[0].sourceName}.`, { exact: true })).toHaveCount(1);
      await expect(results.first().locator("h3 > span[aria-hidden='true']")).toBeHidden();
      await expect(legend.getByText(events[0].sourceName, { exact: true })).toBeVisible();
    });
  }
}

test("unconfigured source colors leave Ivy rows without invented dots", async ({ page }) => {
  const ivy = agendas["ivy-station"];
  expect(parseGoogleCalendarEmbed(laawLifeTenant.locations[0].calendar.src).calendarSources.every(source => source.color === undefined)).toBe(true);
  await page.clock.setFixedTime(new Date(Date.parse(ivy.generatedAt) + 2000));
  await page.route("**/calendar-data/agendas.json", route => route.fulfill({
    json: { ...agendas, "ivy-station": {
      ...ivy,
      generatedAt: new Date(Date.parse(ivy.generatedAt) + 1000).toISOString(),
      events: [{ ...events[0], dateKeys: [ivy.initialDateKey], sourceColor: undefined }],
    } },
  }));
  await page.goto("ivy/");
  const card = page.locator("[data-day-card][data-active='true']");
  await expect(card.locator("h3")).toHaveText("Community event");
  await expect(card.locator(".day-card-event-source-dot")).toHaveCount(0);
  await expect(page.locator("[data-calendar-source-legend]")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Search events" }).fill("Community event");
  await expect(page.getByRole("list", { name: "Matching calendar events" }).locator("h3 > span[aria-hidden='true']")).toHaveCount(0);
});
