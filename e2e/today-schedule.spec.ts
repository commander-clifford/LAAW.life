import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import type { CalendarAgenda } from "../src/application/ports";

const agendas = JSON.parse(
  readFileSync(new URL("../.calendar-data/agendas.json", import.meta.url), "utf8"),
) as Record<string, CalendarAgenda>;
const agenda = agendas["ivy-station"];
const futureDateKeys = agenda.availableDateKeys.filter(
  (dateKey) => dateKey > agenda.initialDateKey && dateKey < agenda.availableDateKeys.at(-1)!,
);
const currentDateKey = futureDateKeys.find(
  (dateKey) => agenda.events.some((event) => event.dateKeys.includes(dateKey)),
) ?? futureDateKeys[0];

function formatDate(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

// At this UTC hour Tokyo is on the following day, while Pacific is still on
// dateKey. This catches accidental use of the visitor's local timezone.
function pacificDay(dateKey: string): Date {
  return new Date(`${dateKey}T19:00:00Z`);
}

test.use({ timezoneId: "Asia/Tokyo" });

test.beforeEach(async ({ page }) => {
  await page.route("https://calendar.google.com/**", (route) =>
    route.fulfill({
      body: "<!doctype html><title>Calendar fixture</title><p>Calendar fixture</p>",
      contentType: "text/html",
    }),
  );
});

test("a new public snapshot refreshes an open page and failures keep the last good schedule", async ({ page }) => {
  await page.clock.install({ time: pacificDay(agenda.initialDateKey) });
  const seed = agenda.events.find((event) => event.dateKeys.includes(agenda.initialDateKey))!;
  expect(seed).toBeTruthy();
  const updated = {
    ...agenda,
    generatedAt: new Date(Date.parse(agenda.generatedAt) + 60_000).toISOString(),
    events: [{ ...seed, title: "Updated community event" }],
  };
  let responseState: "new" | "failed" | "older" = "new";
  let requests = 0;
  await page.route("**/calendar-data/agendas.json", (route) => {
    requests++;
    return route.fulfill({
      status: responseState === "failed" ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify({ ...agendas, "ivy-station": responseState === "older" ? agenda : updated }),
    });
  });
  await page.goto("ivy/");
  const events = page.locator(".today-event h2");
  await expect(events).toHaveText(["Updated community event"]);
  responseState = "failed";
  const beforeFailure = requests;
  await page.clock.runFor(5 * 60_000);
  await expect.poll(() => requests).toBeGreaterThan(beforeFailure);
  await expect(events).toHaveText(["Updated community event"]);
  responseState = "older";
  const beforeOlder = requests;
  await page.clock.runFor(5 * 60_000);
  await expect.poll(() => requests).toBeGreaterThan(beforeOlder);
  await expect(events).toHaveText(["Updated community event"]);
  await page.getByRole("link", { name: "Hawthorne", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hawthorne");
  await expect(events).not.toContainText(["Updated community event"]);
});

test("an old offline snapshot tells visitors to check the live calendar", async ({ page }) => {
  await page.clock.install({ time: new Date(Date.parse(agenda.generatedAt) + 49 * 60 * 60_000) });
  await page.route("**/calendar-data/agendas.json", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("ivy/");
  await expect(page.getByRole("status").filter({ hasText: "Calendar updates are delayed." })).toBeVisible();
  await expect(page.locator("iframe.calendar-frame")).toBeVisible();
});

test("a stale build stays neutral until hydration shows the current Pacific day", async ({ page }) => {
  expect(currentDateKey).toBeTruthy();
  expect(currentDateKey).not.toBe(agenda.initialDateKey);
  await page.clock.setFixedTime(pacificDay(currentDateKey));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    const states: string[] = [];
    Reflect.set(window, "todayRenderStates", states);
    new MutationObserver(() => {
      const text = document.querySelector(".location-page")?.textContent;
      if (text && states.at(-1) !== text) states.push(text);
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });

  let releaseScripts!: () => void;
  const scriptGate = new Promise<void>((resolve) => { releaseScripts = resolve; });
  await page.route(/\/_next\/static\/.*\.js(?:\?|$)/, async (route) => {
    await scriptGate;
    await route.continue();
  });
  try {
    await page.goto("ivy/", { waitUntil: "commit" });
    const card = page.locator(".today-schedule");
    await expect(card).toHaveAttribute("aria-busy", "true");
    await expect(card.getByRole("status")).toHaveText("Loading today's schedule…");
    await expect(card.getByRole("heading")).toHaveCount(0);
    await expect(card).toHaveAttribute("aria-label", "Daily events");
    await expect(card).not.toHaveAttribute("aria-labelledby");
    await expect(card.locator("time, .today-schedule-count")).toHaveCount(0);
    await expect(page.locator(".today-schedule-date time")).toHaveCount(0);
    releaseScripts();

    await expect(card).toHaveAttribute("aria-busy", "false");
    const dateLine = page.locator(".today-schedule-date time");
    await expect(dateLine).toHaveText(formatDate(currentDateKey));
    await expect(dateLine).toHaveAttribute("datetime", currentDateKey);
    await expect(card.locator("header")).toHaveCount(0);
    const dateBox = (await dateLine.boundingBox())!;
    const cardBox = (await card.boundingBox())!;
    expect(dateBox.y + dateBox.height).toBeLessThan(cardBox.y);
    expect(Math.abs(dateBox.x + dateBox.width / 2 - (cardBox.x + cardBox.width / 2))).toBeLessThan(1);
    await expect(card.locator(".today-schedule-date")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ivy Station");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(
      agenda.events.filter((event) => event.dateKeys.includes(currentDateKey)).map((event) => event.title),
    );
    await expect(card.locator(".today-schedule-count, .today-event-details p")).toHaveCount(0);
    await expect(page.locator("iframe.calendar-frame")).toBeVisible();
    const renderStates: string[] = await page.evaluate(() => Reflect.get(window, "todayRenderStates"));
    expect(renderStates.some((state) => state.includes(formatDate(agenda.initialDateKey)))).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    releaseScripts();
  }
});

test("the open card rolls over at Pacific midnight and handles expired coverage", async ({ page }) => {
  // Intl derives the UTC offset for this date so the regression also runs in
  // winter and across daylight-saving changes without hardcoding PDT.
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: agenda.timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(pacificDay(currentDateKey)).find((part) => part.type === "timeZoneName")!.value.replace("GMT", "");
  const beforeMidnight = new Date(`${currentDateKey}T23:59:30${offset}`);
  const nextDateKey = new Date(new Date(`${currentDateKey}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
  await page.clock.install({ time: beforeMidnight });
  await page.goto("ivy/");
  const card = page.locator(".today-schedule");
  await expect(page.locator(".today-schedule-date time")).toHaveText(formatDate(currentDateKey));
  await page.clock.runFor(60_000);
  await expect(page.locator(".today-schedule-date time")).toHaveText(formatDate(nextDateKey));
  await expect(card.getByRole("heading", { level: 2 })).toHaveText(
    agenda.events.filter((event) => event.dateKeys.includes(nextDateKey)).map((event) => event.title),
  );

  const emptyDateKey = agenda.availableDateKeys.find(
    (dateKey) => !agenda.events.some((event) => event.dateKeys.includes(dateKey)),
  );
  if (emptyDateKey) {
    await page.clock.setSystemTime(pacificDay(emptyDateKey));
    await page.clock.runFor(60_000);
    await expect(card).toContainText("Nothing is scheduled for today.");
    await expect(card.locator(".today-schedule-count")).toHaveCount(0);
  }

  const lastDateKey = agenda.availableDateKeys.at(-1)!;
  const expiredDate = new Date(pacificDay(lastDateKey).getTime() + 86_400_000);
  await page.clock.setSystemTime(expiredDate);
  await page.clock.runFor(60_000);
  await expect(card).toContainText("Today's schedule is temporarily unavailable.");
  await expect(card.locator(".today-schedule-count, .today-event")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ivy Station");
  await expect(page.getByRole("heading", { name: "Full calendar" })).toHaveCount(0);
  await expect(page.locator("iframe.calendar-frame")).toHaveAttribute("title", "Ivy Station Calendar");
  await expect(page.locator("iframe.calendar-frame")).toBeVisible();
});
