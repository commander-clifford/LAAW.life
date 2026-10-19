import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";

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
async function expectSourceDot(dot: Locator, sourceColor: string | undefined) {
  await expect(dot).toBeHidden();
  await expect(dot).not.toHaveAttribute("style");
  await expect(dot).toHaveClass(/(?:^|\s)calendar-source--[a-z0-9]+(?:-[a-z0-9]+)*(?:\s|$)/);
  await expect(dot).not.toHaveClass(new RegExp(sourceColor!.slice(1), "i"));
  await expect(dot).toHaveCSS("border-width", "0px");
  await expect(dot).toHaveCSS("background-color", rgb(sourceColor));
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
    test(`source colors remain available while indicators are hidden at ${width}px in ${appearance}`, async ({ page }) => {
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
        await expectSourceDot(row.locator(".day-card-event-source-dot"), event.sourceColor);
        await expect(row.getByText(`Calendar: ${event.sourceName}.`, { exact: true })).toHaveCount(1);
        await expect(row.locator("h3")).toHaveAttribute("title", `Calendar: ${event.sourceName}`);
        await expect(row.locator("time > [aria-hidden]")).toHaveText("All day");
      }
      expect(await card.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      const firstCardDate = await card.locator(".day-card-date time").getAttribute("datetime");
      await page.getByRole("button", { name: "Go to Tomorrow", exact: true }).click();
      await expect(page.locator(".day-carousel")).toHaveAttribute("data-active-index", "1");
      await page.getByRole("button", { name: "Go to Today", exact: true }).click();
      await expect(card.locator(".day-card-date time")).toHaveAttribute("datetime", firstCardDate!);

      await expect(page.getByText("Calendar colors", { exact: true })).toHaveCount(0);
      await expect(page.locator("[data-calendar-source-legend]")).toHaveCount(0);

      await page.getByRole("searchbox", { name: "Search events" }).fill("fixture");
      const results = page.getByRole("list", { name: "Matching calendar events" }).locator("li");
      await expect(results).toHaveCount(3);
      await expect(results.locator("h3 > span[aria-hidden='true']")).toHaveCount(3);
      for (const [index, event] of events.slice(1).entries()) {
        await expectSourceDot(results.nth(index).locator("h3 > span[aria-hidden='true']"), event.sourceColor);
        await expect(results.nth(index).getByText(event.sourceName, { exact: true })).toBeVisible();
      }
      const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(audit.violations).toEqual([]);
      await page.emulateMedia({ forcedColors: "active" });
      await expect(card.locator(".day-card-event-source-dot").first()).toBeHidden();
      await expect(card.getByText(`Calendar: ${events[0].sourceName}.`, { exact: true })).toHaveCount(1);
      await expect(results.first().locator("h3 > span[aria-hidden='true']")).toBeHidden();
    });
  }
}

test("unknown fixture sources stay uncolored even when Ivy has verified colors", async ({ page }) => {
  const ivy = agendas["ivy-station"];
  expect(parseGoogleCalendarEmbed(laawLifeTenant.locations[0].calendar.src).calendarSources.every(source => source.color === "#7986CB")).toBe(true);
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
  await expect(card.locator("h3")).toHaveText(["Community event"]);
  await expect(card.locator(".day-card-event-source-dot")).toHaveCount(0);
  await expect(page.locator("[data-calendar-source-legend]")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Search events" }).fill("Community event");
  await expect(page.getByRole("list", { name: "Matching calendar events" }).locator("h3 > span[aria-hidden='true']")).toHaveCount(0);
});

for (const [route, locationId, name] of [
  ["ivy", "ivy-station", "LA Ale Works - Culver City"],
  ["hawthorne", "hawthorne", "LA Ale Works - Hawthorne"],
] as const) {
  for (const width of [448, 1280]) {
    for (const appearance of ["system", "light"] as const) {
      test(`${route} preserves hidden source colors on a white page at ${width}px with ${appearance} light`, async ({ page }) => {
        const bundled = agendas[locationId];
        const location = laawLifeTenant.locations.find(location => location.id === locationId)!;
        const venue = parseGoogleCalendarEmbed(location.calendar.src).calendarSources[0];
        await page.setViewportSize({ width, height: 874 });
        await page.emulateMedia({ colorScheme: appearance === "light" ? "dark" : "light" });
        if (appearance === "light") {
          await page.addInitScript(() => window.localStorage.setItem("laaw-life:theme:v1", "light"));
        }
        await page.clock.setFixedTime(new Date(Date.parse(bundled.generatedAt) + 2000));
        // A newer snapshot from an older generator lacks both color and source
        // metadata. The configured calendar ID still identifies its venue.
        const legacyEvents = ["Vivace", "@Luckyguesstrivia"].map((title, index) => ({
          allDay: true, dateKeys: [bundled.initialDateKey],
          end: `${bundled.initialDateKey}T20:00:00.000Z`,
          id: `${venue.calendarId}:legacy-color-fixture-${index}`,
          location: null, sourceName: name,
          start: `${bundled.initialDateKey}T19:00:00.000Z`, title,
        }));
        await page.route("**/calendar-data/agendas.json", route => route.fulfill({
          json: { ...agendas, [locationId]: {
            ...bundled, generatedAt: new Date(Date.parse(bundled.generatedAt) + 1000).toISOString(),
            events: legacyEvents,
          } },
        }));
        await page.goto(`${route}/`);
        await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
        await expect(page.locator(".site-canvas")).toHaveCSS("background-color", "rgb(255, 255, 255)");
        await expect(page.locator(".site-header")).toHaveCSS("background-color", "rgb(227, 227, 227)");
        const card = page.locator("[data-day-card][data-active='true']");
        await expect(card.locator("h3")).toHaveText(["Vivace", "@Luckyguesstrivia"]);
        await expect(card.locator(".day-card-event-source-dot")).toHaveCount(2);
        for (const dot of await card.locator(".day-card-event-source-dot").all()) {
          await expectSourceDot(dot, venue.color);
        }
        await expect(page.getByText("Calendar colors", { exact: true })).toHaveCount(0);
        await expect(page.locator("[data-calendar-source-legend]")).toHaveCount(0);
        const input = page.getByRole("searchbox", { name: "Search events" });
        await input.fill("Vivace");
        const resultDot = page.getByRole("list", { name: "Matching calendar events" }).locator("h3 > span[aria-hidden='true']");
        await expect(resultDot).toHaveCount(1);
        await expectSourceDot(resultDot, venue.color);
        await expect(page.getByText("Calendar colors", { exact: true })).toHaveCount(0);
        await input.focus();
        expect(await input.evaluate(element => getComputedStyle(element).boxShadow)).not.toBe("none");
        const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(audit.violations).toEqual([]);
        await page.getByRole("button", { name: "Open location navigation", exact: true }).click();
        await expect(page.getByLabel("Appearance")).toHaveValue(appearance);
        await page.getByLabel("Appearance").focus();
        expect(await page.getByLabel("Appearance").evaluate(element => getComputedStyle(element).boxShadow)).not.toBe("none");
        const drawerAudit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(drawerAudit.violations).toEqual([]);
      });
    }
  }
}
