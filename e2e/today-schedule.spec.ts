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
  }).format(new Date(`${dateKey}T12:00:00Z`)).replace(/^([^,]+),/, "$1");
}

// At this UTC hour Tokyo is on the following day, while Pacific is still on
// dateKey. This catches accidental use of the visitor's local timezone.
function pacificDay(dateKey: string): Date {
  return new Date(`${dateKey}T19:00:00Z`);
}

// A build made after Pacific noon must not look hours into the future relative
// to the test clock: the application correctly rejects future-dated snapshots.
function snapshotDay(): Date {
  return new Date(Math.max(
    pacificDay(agenda.initialDateKey).getTime(),
    ...Object.values(agendas).map((source) => Date.parse(source.generatedAt)),
  ));
}

test.use({ timezoneId: "Asia/Tokyo", reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await page.route("https://calendar.google.com/**", (route) =>
    route.fulfill({
      body: "<!doctype html><title>Calendar fixture</title><p>Calendar fixture</p>",
      contentType: "text/html",
    }),
  );
});

test("a new public snapshot refreshes an open page and failures keep the last good schedule", async ({ page }) => {
  await page.clock.install({ time: snapshotDay() });
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
  await page.getByRole("button", { name: "Open location navigation" }).click();
  await page.getByRole("navigation", { name: "Location calendars" }).getByRole("link", { name: "Hawthorne", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hawthorne");
  await expect(events).not.toContainText(["Updated community event"]);
});

test("an old offline snapshot tells visitors to check the live calendar", async ({ page }) => {
  await page.clock.install({ time: new Date(Date.parse(agenda.generatedAt) + 49 * 60 * 60_000) });
  await page.route("**/calendar-data/agendas.json", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("ivy/");
  await expect(page.getByRole("status").filter({ hasText: "Calendar updates are delayed." })).toBeVisible();
  await page.getByRole("button", { name: "Open calendar", exact: true }).click();
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
    const weekdayBox = (await dateLine.locator(".today-schedule-weekday").boundingBox())!;
    const calendarDateBox = (await dateLine.locator(".today-schedule-calendar-date").boundingBox())!;
    expect(calendarDateBox.y).toBeGreaterThan(weekdayBox.y + weekdayBox.height);
    await expect(dateLine.locator(".today-schedule-weekday")).toHaveCSS("font-weight", "700");
    await expect(card.locator("header")).toHaveCount(0);
    const outerCard = page.locator(".daily-information-card");
    await expect(outerCard.locator(".today-schedule-date time")).toHaveText(formatDate(currentDateKey));
    await expect(outerCard.getByRole("heading", { level: 1 })).toHaveCount(0);
    const dateBox = (await dateLine.boundingBox())!;
    const eventsBox = (await card.boundingBox())!;
    const outerBox = (await outerCard.boundingBox())!;
    expect(dateBox.y + dateBox.height).toBeLessThan(eventsBox.y);
    expect(dateBox.y + dateBox.height).toBeLessThan(outerBox.y + outerBox.height);
    await expect(card.locator(".today-schedule-date")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ivy Station");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(
      agenda.events.filter((event) => event.dateKeys.includes(currentDateKey)).map((event) => event.title),
    );
    await expect(card.locator(".today-schedule-count, .today-event-details p")).toHaveCount(0);
    await page.getByRole("button", { name: "Open calendar", exact: true }).click();
    await expect(page.locator("iframe.calendar-frame")).toBeVisible();
    const renderStates: string[] = await page.evaluate(() => Reflect.get(window, "todayRenderStates"));
    expect(renderStates.some((state) => state.includes(formatDate(agenda.initialDateKey)))).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    releaseScripts();
  }
});

for (const width of [1440, 393, 320]) {
  test(`the unified card fills available width up to 512px and wraps long schedules at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(snapshotDay());
    let eventCount = 1;
    await page.route("**/calendar-data/agendas.json", (route) => {
      const payload = Object.fromEntries(Object.entries(agendas).map(([id, source]) => {
        const seed = source.events.find((event) => event.dateKeys.includes(source.initialDateKey))!;
        return [id, {
          ...source,
          generatedAt: new Date(Date.parse(source.generatedAt) + eventCount * 60_000).toISOString(),
          events: Array.from({ length: eventCount }, (_, index) => ({
            ...seed,
            id: `${seed.id}-${index}`,
            allDay: index === 0,
            start: `${source.initialDateKey}T${index === 1 ? "16" : "18"}:00:00.000Z`,
            end: `${source.initialDateKey}T${index === 1 ? "17" : "20"}:00:00.000Z`,
            title: index === 0 ? "Community meetup" : index === 1
              ? "A community celebration with live music, local food, and a very long event name that needs to wrap"
              : "AReallyLongUnbrokenCommunityEventNameThatMustNeverEscapeTheCardBoundary",
          })),
        }];
      }));
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(payload) });
    });
    for (const [slug, name] of [["ivy", "Ivy Station"], ["hawthorne", "Hawthorne"]]) {
      eventCount = 1;
      await page.goto(`${slug}/`);
      const card = page.locator(".daily-information-card");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("text-align", "left");
      await expect(card.getByRole("heading", { level: 1 })).toHaveCount(0);
      await expect(card.locator(".today-event h2")).toHaveText(["Community meetup"]);
      const compactBox = (await card.boundingBox())!;
      const locationBox = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      expect(compactBox.y).toBeGreaterThan(locationBox.y + locationBox.height);
      const contentWidth = (await page.locator(".site-main-content").boundingBox())!.width;
      expect(Math.abs(compactBox.width - Math.min(contentWidth, 512))).toBeLessThan(1);
      expect(compactBox.x + compactBox.width / 2).toBeCloseTo(width / 2, 0);
      const eventsBox = (await card.locator(".today-schedule").boundingBox())!;
      const dateBox = (await card.locator(".today-schedule-date").boundingBox())!;
      expect(eventsBox.y).toBeGreaterThan(dateBox.y + dateBox.height);
      const headingBox = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      expect(headingBox.x + headingBox.width / 2).toBeCloseTo(compactBox.x + compactBox.width / 2, 0);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-weight", "300");
      await expect(card.locator(".today-schedule-weekday")).toHaveCSS("text-align", "left");
      await expect(card.locator(".today-schedule-calendar-date")).toHaveCSS("text-align", "left");
      await expect(card.locator(".today-event-time").first()).toHaveCSS(
        "color",
        await card.locator(".today-schedule-date").evaluate((element) => getComputedStyle(element).color),
      );

      eventCount = 3;
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(card.locator(".today-event")).toHaveCount(3);
      expect(Math.abs((await card.boundingBox())!.width - Math.min(contentWidth, 512))).toBeLessThan(1);
      expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const listBox = (await card.locator(".today-event-list").boundingBox())!;
      const firstTitleBox = (await card.locator(".today-event h2").first().boundingBox())!;
      expect(new Set(await card.locator(".today-event time").allTextContents()).size).toBe(3);
      for (const event of await card.locator(".today-event").all()) {
        const title = (await event.locator("h2").boundingBox())!;
        const time = (await event.locator("time").boundingBox())!;
        expect(title.x).toBeGreaterThan(time.x + time.width);
        expect(Math.abs(time.x - listBox.x)).toBeLessThan(1);
        expect(Math.abs(title.x - firstTitleBox.x)).toBeLessThan(1);
        expect(title.x + title.width).toBeLessThanOrEqual(listBox.x + listBox.width + 1);
        expect(await event.locator(":scope > :first-child").evaluate((element) => element.tagName)).toBe("TIME");
        // The smaller time shares the title's first baseline.
        expect(Math.abs(time.y - title.y)).toBeLessThan(4);
      }
      await expect(page.getByRole("heading", { name: "Today", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Open calendar", exact: true }).click();
      const calendarBox = (await page.locator("iframe.calendar-frame").boundingBox())!;
      const disclosureBox = (await page.locator(".calendar-disclosure").boundingBox())!;
      const fullCardBox = (await card.boundingBox())!;
      expect(calendarBox.y).toBeGreaterThan(fullCardBox.y + fullCardBox.height);
      expect(calendarBox.x).toBeCloseTo(disclosureBox.x, 0);
      expect(calendarBox.width).toBeCloseTo(disclosureBox.width, 0);
      expect(calendarBox.height).toBeLessThanOrEqual(448);
      await expect(page.locator(".calendar-status")).toBeHidden();
    }
  });
}

test("the calendar loads on first opening and keeps its loaded frame when closed", async ({ page }) => {
  let calendarRequests = 0;
  page.on("request", (request) => {
    if (request.url().startsWith("https://calendar.google.com/")) calendarRequests++;
  });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("ivy/");
  const toggle = page.getByRole("button", { name: "Open calendar", exact: true });
  await expect(page.locator(".today-schedule")).toHaveAttribute("aria-busy", "false");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toHaveCSS("text-decoration-line", "none");
  await expect(page.locator("iframe.calendar-frame")).toHaveCount(0);
  expect(calendarRequests).toBe(0);
  await toggle.focus();
  await page.keyboard.press("Enter");
  const close = page.getByRole("button", { name: "Close calendar", exact: true });
  await expect(close).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("iframe.calendar-frame")).toBeVisible();
  await expect.poll(() => calendarRequests).toBe(1);
  const frame = (await page.locator("iframe.calendar-frame").boundingBox())!;
  expect(frame.x).toBeCloseTo(393 - frame.x - frame.width, 0);
  expect(393 - frame.x - frame.width).toBeGreaterThanOrEqual(16);
  await close.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toBeFocused();
  await expect(page.locator("iframe.calendar-frame")).toBeHidden();
  await expect(page.locator("iframe.calendar-frame")).toHaveCount(1);
  await toggle.click();
  await expect(page.locator("iframe.calendar-frame")).toBeVisible();
  expect(calendarRequests).toBe(1);
  await page.getByRole("button", { name: "Open location navigation" }).click();
  await page.getByRole("navigation", { name: "Location calendars" }).getByRole("link", { name: "Hawthorne", exact: true }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(calendarRequests).toBe(1);
});

test("the centered app shell fills mobile and stays intentional on wide screens", async ({ page }, testInfo) => {
  for (const [width, height] of [[320, 667], [393, 852], [430, 932], [393, 1200], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    for (const slug of ["ivy", "hawthorne"]) {
      await page.goto(`${slug}/`);
      await expect(page.locator(".today-schedule")).toHaveAttribute("aria-busy", "false");
      await expect(page.getByRole("contentinfo")).toHaveCount(1);
      for (const open of [false, true]) {
        if (open) {
          await page.getByRole("button", { name: "Open calendar", exact: true }).click();
          await expect(page.locator(".calendar-shell")).toHaveAttribute("aria-busy", "false");
        }
        const main = (await page.locator(".site-main").boundingBox())!;
        const content = (await page.locator(".site-main-content").boundingBox())!;
        expect(main.height).toBeCloseTo(content.height, 0);
        expect(width - content.x - content.width).toBeCloseTo(content.x, 0);
        expect(content.width).toBeCloseTo(Math.min(width - 2 * Math.min(32, Math.max(16, width * 0.04)), 1024), 0);
        for (const selector of [".location-heading-section", ".today-section", ".calendar-disclosure", ".site-header-inner", ".site-footer-inner"]) {
          const box = (await page.locator(selector).boundingBox())!;
          expect(box.x + box.width / 2).toBeCloseTo(width / 2, 0);
        }
        const calendarControl = (await page.locator(".calendar-disclosure-toggle").boundingBox())!;
        const card = (await page.locator(".daily-information-card").boundingBox())!;
        expect(calendarControl.x + calendarControl.width / 2).toBeCloseTo(card.x + card.width / 2, 0);
        expect(calendarControl.y - card.y - card.height).toBeCloseTo(32, 0);
        if (width < 512) {
          expect((await page.locator(".daily-information-card").boundingBox())!.width).toBeCloseTo(content.width, 0);
        }
        if (open) {
          const disclosure = (await page.locator(".calendar-disclosure").boundingBox())!;
          const frame = (await page.locator(".calendar-frame").boundingBox())!;
          expect(frame.x).toBeCloseTo(disclosure.x, 0);
          expect(frame.width).toBeCloseTo(disclosure.width, 0);
          expect(width - frame.x - frame.width).toBeGreaterThanOrEqual(Math.min(32, Math.max(16, width * 0.04)));
          expect(frame.y - calendarControl.y - calendarControl.height).toBeCloseTo(0, 0);
        }
        const pageSize = await page.evaluate(() => ({
          height: document.documentElement.scrollHeight,
          width: document.documentElement.scrollWidth,
          scrollY: window.scrollY,
        }));
        const footer = (await page.getByRole("contentinfo").boundingBox())!;
        expect(footer.y).toBeCloseTo(main.y + main.height, 0);
        expect(pageSize.height).toBeLessThanOrEqual(Math.ceil(Math.max(height, footer.y + footer.height + pageSize.scrollY)) + 1);
        expect(pageSize.width).toBeLessThanOrEqual(width);
        if (slug === "ivy" && [393, 1440].includes(width) && height !== 1200) {
          const screenshotPath = testInfo.outputPath(`layout-${width}-${open ? "open" : "closed"}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          await testInfo.attach("layout", { path: screenshotPath, contentType: "image/png" });
        }
      }
    }
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
  await page.getByRole("button", { name: "Open calendar", exact: true }).click();
  await expect(page.locator("iframe.calendar-frame")).toHaveAttribute("title", "Ivy Station Calendar");
  await expect(page.locator("iframe.calendar-frame")).toBeVisible();
});
