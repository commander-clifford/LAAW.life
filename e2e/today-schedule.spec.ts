import { readFileSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { getDateKey } from "../src/application/calendar-dates";
import type { CalendarAgenda, CalendarAgendaItem } from "../src/application/ports";

const agendas = JSON.parse(
  readFileSync(new URL("../.calendar-data/agendas.json", import.meta.url), "utf8"),
) as Record<string, CalendarAgenda>;
const agenda = agendas["ivy-station"];
const dayCardCount = 7;
const relativeDayLabels = [
  "Today",
  "Tomorrow",
  "In 2 days",
  "In 3 days",
  "In 4 days",
  "In 5 days",
  "In 6 days",
] as const;

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 12))
    .toISOString()
    .slice(0, 10);
}

function getDayCardDateKeys(dateKey: string): string[] {
  return Array.from({ length: dayCardCount }, (_, index) =>
    addDays(dateKey, index)
  );
}

const futureDateKeys = agenda.availableDateKeys.filter(
  (dateKey) =>
    dateKey > agenda.initialDateKey &&
    getDayCardDateKeys(dateKey).every((key) =>
      agenda.availableDateKeys.includes(key)
    ),
);
const currentDateKey = futureDateKeys[0];
if (!currentDateKey) {
  throw new Error("Calendar fixture needs a covered future seven-day window.");
}

function fixtureEvent(
  dateKey: string,
  id: string,
  title: string,
  overrides: Partial<CalendarAgendaItem> = {},
): CalendarAgendaItem {
  return {
    allDay: true,
    dateKeys: [dateKey],
    end: `${addDays(dateKey, 1)}T08:00:00.000Z`,
    id,
    location: null,
    sourceName: "Deterministic test calendar",
    start: `${dateKey}T08:00:00.000Z`,
    title,
    ...overrides,
  };
}

function formatDate(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00Z`)).replace(/^([^,]+),/, "$1");
}

function formatFullDate(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

function getCarousel(page: Page): Locator {
  return page.getByRole("region", { name: "Seven-day schedule" });
}

function getActiveCard(page: Page): Locator {
  return getCarousel(page).locator("[data-day-card][data-active='true']");
}

function getDots(page: Page): Locator {
  return getCarousel(page).locator(".day-carousel-dot");
}

function getTodayControl(page: Page, dateKey: string): Locator {
  return page.locator(".location-today-control").filter({
    has: page.locator(`time[datetime="${dateKey}"]`),
  });
}

async function expectActiveDay(page: Page, index: number): Promise<void> {
  const carousel = getCarousel(page);
  const dots = getDots(page);
  await expect(carousel).toHaveAttribute("data-active-index", String(index));
  await expect(dots.nth(index)).toHaveAttribute("aria-current", "true");
  await expect(carousel.locator(".day-carousel-dot[aria-current='true']")).toHaveCount(1);
  await expect(getActiveCard(page)).toHaveAttribute("data-day-index", String(index));
}

type CarouselGeometry = Readonly<{
  activeWidth: number;
  activeCenterError: number;
  leftInset: number;
  maxScrollLeft: number;
  rightInset: number;
  scrollLeft: number;
  viewportWidth: number;
  visibleWidths: number[];
  windowWidth: number;
}>;

type TodayControlMotion = Readonly<{
  dateLeft: number;
  dateRight: number;
  direction: string | undefined;
  opacity: number;
  physicalProgress: number;
  progress: number;
  scrollLeft: number;
  stageRight: number;
  travel: number;
  translationX: number;
  viewportWidth: number;
}>;

type RecordedAnalyticsEvent = Readonly<{
  name: string;
  parameters: Record<string, boolean | number | string>;
}>;

async function installAnalyticsRecorder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const events: Array<{
      name: string;
      parameters: Record<string, boolean | number | string>;
    }> = [];
    Reflect.set(window, "analyticsEvents", events);
    Reflect.set(window, "gtag", (...args: unknown[]) => {
      if (args[0] !== "event" || typeof args[1] !== "string") return;
      events.push({
        name: args[1],
        parameters: args[2] as Record<string, boolean | number | string>,
      });
    });
  });
}

async function getAnalyticsEvents(page: Page): Promise<RecordedAnalyticsEvent[]> {
  return page.evaluate(() =>
    Reflect.get(window, "analyticsEvents") as RecordedAnalyticsEvent[]
  );
}

async function getTodayControlMotion(page: Page): Promise<TodayControlMotion> {
  return page.locator(".location-today-control").evaluate((control) => {
    const controlStyle = getComputedStyle(control);
    const time = control.querySelector("time");
    if (!time) throw new Error("The current-date control does not have a time element.");
    const transform = getComputedStyle(time).transform;
    const translationX = transform === "none"
      ? 0
      : new DOMMatrixReadOnly(transform).m41;
    const dateRect = time.getBoundingClientRect();
    const viewport = document.querySelector<HTMLElement>(
      ".day-carousel-viewport",
    );
    const cards = viewport?.querySelectorAll<HTMLElement>("[data-day-card]");
    const todayRect = cards?.item(0).getBoundingClientRect();
    const tomorrowRect = cards?.item(1).getBoundingClientRect();
    const viewportRect = viewport?.getBoundingClientRect();
    const snapDistance = todayRect && tomorrowRect
      ? tomorrowRect.left + tomorrowRect.width / 2 -
        (todayRect.left + todayRect.width / 2)
      : 0;
    const physicalProgress = viewportRect && todayRect && snapDistance > 0
      ? Math.min(Math.max(
        (viewportRect.left + viewportRect.width / 2 -
          (todayRect.left + todayRect.width / 2)) / snapDistance,
        0,
      ), 1)
      : 0;

    return {
      dateLeft: dateRect.left,
      dateRight: dateRect.right,
      direction: (control as HTMLElement).dataset.scrollDirection,
      opacity: Number(controlStyle.opacity),
      physicalProgress,
      progress: Number((control as HTMLElement).dataset.scrollProgress),
      scrollLeft: viewport?.scrollLeft ?? 0,
      stageRight: Number((control as HTMLElement).dataset.scrollStageRight),
      travel: Number((control as HTMLElement).dataset.scrollTravel),
      translationX,
      viewportWidth: document.documentElement.clientWidth,
    };
  });
}

async function setTodayScrollProgress(
  page: Page,
  fraction: number,
): Promise<number> {
  return getCarousel(page).locator(".day-carousel-viewport").evaluate(
    (viewport, requestedFraction) => {
      const cards = viewport.querySelectorAll<HTMLElement>("[data-day-card]");
      const todayCard = cards.item(0);
      const tomorrowCard = cards.item(1);
      if (!todayCard || !tomorrowCard) {
        throw new Error("The carousel needs Today and Tomorrow cards.");
      }

      viewport.style.scrollSnapType = "none";
      const snapDistance = tomorrowCard.offsetLeft - todayCard.offsetLeft;
      viewport.scrollLeft = snapDistance * requestedFraction;
      viewport.dispatchEvent(new Event("scroll"));
      return snapDistance;
    },
    fraction,
  );
}

async function getCarouselGeometry(page: Page): Promise<CarouselGeometry> {
  return getCarousel(page).locator(".day-carousel-viewport").evaluate((viewport) => {
    const activeCard = viewport.querySelector<HTMLElement>(
      "[data-day-card][data-active='true']",
    );
    if (!activeCard) {
      throw new Error("The carousel does not have an active card.");
    }

    const activeRect = activeCard.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const activeCenter = activeRect.left + activeRect.width / 2;
    const viewportCenter = viewportRect.left + viewportRect.width / 2;
    const visibleWidths = [
      ...viewport.querySelectorAll<HTMLElement>("[data-day-card]"),
    ].map((card) => {
      const cardRect = card.getBoundingClientRect();
      return Math.max(
        0,
        Math.min(viewportRect.right, cardRect.right) -
          Math.max(viewportRect.left, cardRect.left),
      );
    });

    return {
      activeWidth: activeRect.width,
      activeCenterError: Math.abs(activeCenter - viewportCenter),
      leftInset: activeRect.left - viewportRect.left,
      maxScrollLeft: viewport.scrollWidth - viewport.clientWidth,
      rightInset: viewportRect.right - activeRect.right,
      scrollLeft: viewport.scrollLeft,
      viewportWidth: viewportRect.width,
      visibleWidths,
      windowWidth: window.innerWidth,
    };
  });
}

async function expectCenteredCard(
  page: Page,
  index: number,
): Promise<CarouselGeometry> {
  await expect.poll(async () =>
    (await getCarouselGeometry(page)).activeCenterError
  ).toBeLessThan(0.5);
  const geometry = await getCarouselGeometry(page);
  expect(Math.abs(geometry.leftInset - geometry.rightInset)).toBeLessThanOrEqual(2);
  expect(geometry.leftInset).toBeGreaterThanOrEqual(-1);
  expect(geometry.rightInset).toBeGreaterThanOrEqual(-1);

  const previousPeek = index === 0 ? 0 : geometry.visibleWidths[index - 1];
  const nextPeek = index === dayCardCount - 1
    ? 0
    : geometry.visibleWidths[index + 1];
  if (index > 0) expect(previousPeek).toBeGreaterThanOrEqual(8);
  if (index < dayCardCount - 1) expect(nextPeek).toBeGreaterThanOrEqual(8);
  if (geometry.windowWidth < 552) {
    expect(geometry.activeWidth / geometry.viewportWidth).toBeGreaterThanOrEqual(
      0.895,
    );
    expect(geometry.activeWidth / geometry.viewportWidth).toBeLessThanOrEqual(
      0.905,
    );
    const minimumPeek = geometry.windowWidth <= 330 ? 8 : 12;
    const maximumPeek = geometry.windowWidth <= 330 ? 12 : 18;
    if (index > 0) {
      expect(previousPeek).toBeGreaterThanOrEqual(minimumPeek);
      expect(previousPeek).toBeLessThanOrEqual(maximumPeek);
    }
    if (index < dayCardCount - 1) {
      expect(nextPeek).toBeGreaterThanOrEqual(minimumPeek);
      expect(nextPeek).toBeLessThanOrEqual(maximumPeek);
    }
  }
  if (index > 0 && index < dayCardCount - 1) {
    expect(Math.abs(previousPeek - nextPeek)).toBeLessThanOrEqual(2);
  }
  for (const [cardIndex, visibleWidth] of geometry.visibleWidths.entries()) {
    if (Math.abs(cardIndex - index) > 1) {
      expect(visibleWidth).toBeLessThan(1);
    }
  }

  return geometry;
}

async function dispatchTouchSwipe(
  page: Page,
  viewport: Locator,
  direction: "left" | "right",
): Promise<void> {
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Day-card viewport is not visible.");

  const startX = box.x + box.width * (direction === "left" ? 0.75 : 0.25);
  const endX = box.x + box.width * (direction === "left" ? 0.25 : 0.75);
  const y = box.y + Math.min(box.height / 2, 120);
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [{ x: startX, y }],
      type: "touchStart",
    });
    for (let step = 1; step <= 4; step++) {
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [{
          x: startX + (endX - startX) * (step / 4),
          y,
        }],
        type: "touchMove",
      });
    }
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [],
      type: "touchEnd",
    });
  } finally {
    await session.detach();
  }
  // Give Chromium's native touch-scroll and snap gesture time to release before
  // the next synthetic contact starts; back-to-back CDP contacts can otherwise
  // be coalesced even though real fingers cannot begin in the same instant.
  await page.waitForTimeout(100);
}

async function dispatchTouchDrag(
  page: Page,
  target: Locator,
  deltaX: number,
  deltaY: number,
): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error("Touch target is not visible.");

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height * 0.75;
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [{ x: startX, y: startY }],
      type: "touchStart",
    });
    for (let step = 1; step <= 6; step++) {
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [{
          x: startX + deltaX * (step / 6),
          y: startY + deltaY * (step / 6),
        }],
        type: "touchMove",
      });
    }
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [],
      type: "touchEnd",
    });
  } finally {
    await session.detach();
  }
  await page.waitForTimeout(100);
}

async function dispatchTouchPath(
  page: Page,
  target: Locator,
  offsets: readonly Readonly<{ x: number; y: number }>[],
): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error("Touch target is not visible.");

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height * 0.75;
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [{ x: startX, y: startY }],
      type: "touchStart",
    });
    for (const offset of offsets) {
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [{ x: startX + offset.x, y: startY + offset.y }],
        type: "touchMove",
      });
    }
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [],
      type: "touchEnd",
    });
  } finally {
    await session.detach();
  }
  await page.waitForTimeout(100);
}

async function dispatchPenDrag(
  page: Page,
  viewport: Locator,
  direction: "left" | "right",
): Promise<void> {
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Day-card viewport is not visible.");

  const startX = box.x + box.width * (direction === "left" ? 0.75 : 0.25);
  const endX = direction === "left"
    ? box.x - 40
    : box.x + box.width + 40;
  const y = box.y + Math.min(box.height / 2, 120);
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchMouseEvent", {
      button: "none",
      buttons: 0,
      pointerType: "pen",
      type: "mouseMoved",
      x: startX,
      y,
    });
    await session.send("Input.dispatchMouseEvent", {
      button: "left",
      buttons: 1,
      clickCount: 1,
      pointerType: "pen",
      type: "mousePressed",
      x: startX,
      y,
    });
    for (let step = 1; step <= 6; step++) {
      await session.send("Input.dispatchMouseEvent", {
        button: "none",
        buttons: 1,
        pointerType: "pen",
        type: "mouseMoved",
        x: startX + (endX - startX) * (step / 6),
        y,
      });
    }
    await session.send("Input.dispatchMouseEvent", {
      button: "left",
      buttons: 0,
      clickCount: 1,
      pointerType: "pen",
      type: "mouseReleased",
      x: endX,
      y,
    });
  } finally {
    await session.detach();
  }
  // Let Chromium finish releasing the synthetic pen contact and apply the
  // carousel's nearest-card snap before measuring its centered geometry.
  await page.waitForTimeout(100);
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

test("a new public snapshot refreshes future cards and failures keep the last good schedule", async ({ page }) => {
  await page.clock.install({ time: snapshotDay() });
  const dateKeys = getDayCardDateKeys(agenda.initialDateKey);
  const updated = {
    ...agenda,
    generatedAt: new Date(Date.parse(agenda.generatedAt) + 60_000).toISOString(),
    events: dateKeys.map((dateKey, index) => fixtureEvent(
      dateKey,
      `updated-community-event-${index}`,
      `Updated community event ${index + 1}`,
    )),
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
  await expect(getCarousel(page)).toHaveAttribute("aria-busy", "false");
  await expect(getDots(page)).toHaveCount(dayCardCount);
  await getDots(page).nth(4).click();
  await expectActiveDay(page, 4);
  await expectCenteredCard(page, 4);
  const selectedDateKey = await getActiveCard(page)
    .locator(".day-card-date time")
    .getAttribute("datetime");
  expect(selectedDateKey).toBeTruthy();
  const futureEvents = getActiveCard(page).locator(".day-card-event h3");
  await expect(futureEvents).toHaveText(["Updated community event 5"]);
  responseState = "failed";
  const beforeFailure = requests;
  await page.clock.runFor(5 * 60_000);
  await expect.poll(() => requests).toBeGreaterThan(beforeFailure);
  await expect(getActiveCard(page).locator(".day-card-date time")).toHaveAttribute(
    "datetime",
    selectedDateKey!,
  );
  await expect(futureEvents).toHaveText(["Updated community event 5"]);
  responseState = "older";
  const beforeOlder = requests;
  await page.clock.runFor(5 * 60_000);
  await expect.poll(() => requests).toBeGreaterThan(beforeOlder);
  await expect(getActiveCard(page).locator(".day-card-date time")).toHaveAttribute(
    "datetime",
    selectedDateKey!,
  );
  await expect(futureEvents).toHaveText(["Updated community event 5"]);
  await page.getByRole("button", { name: "Open location navigation" }).click();
  await page.getByRole("navigation", { name: "Location calendars" }).getByRole("link", { name: "Hawthorne", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hawthorne");
  await expect(page.getByText("Updated community event 5", { exact: true })).toHaveCount(0);
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
  await page.emulateMedia({ reducedMotion: "reduce" });
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
    const carousel = getCarousel(page);
    await expect(carousel).toHaveAttribute("aria-busy", "true");
    await expect(carousel.getByRole("status")).toHaveText("Loading today's schedule…");
    await expect(carousel.getByRole("heading")).toHaveCount(0);
    await expect(carousel).toHaveAttribute("aria-label", "Seven-day schedule");
    await expect(carousel).not.toHaveAttribute("aria-labelledby");
    await expect(carousel.locator("time, [data-day-card]")).toHaveCount(0);
    await expect(page.locator(".location-today-placeholder")).toHaveCount(1);
    await expect(page.locator(".location-today-control")).toHaveCount(0);
    const loadingWidth = (
      await carousel.locator(".day-carousel-loading-frame").boundingBox()
    )!.width;
    releaseScripts();

    await expect(carousel).toHaveAttribute("aria-busy", "false");
    const expectedDateKeys = getDayCardDateKeys(currentDateKey);
    const cards = carousel.locator("[data-day-card]");
    const dateLines = cards.locator(".day-card-date time");
    const dayHeadings = cards.getByRole("heading", { level: 2 });
    const eventRegions = cards.getByRole("region");
    const dots = getDots(page);
    await expect(cards).toHaveCount(dayCardCount);
    await expect(dayHeadings).toHaveCount(dayCardCount);
    await expect(eventRegions).toHaveCount(dayCardCount);
    await expect(dots).toHaveCount(dayCardCount);
    const todayControl = getTodayControl(page, currentDateKey);
    await expect(todayControl).toHaveCount(1);
    await expect(todayControl).toHaveAttribute(
      "aria-label",
      `Return to Today, ${formatFullDate(currentDateKey)}`,
    );
    await expect(todayControl).toHaveCSS("opacity", "0");
    await expect(todayControl).toBeDisabled();
    await expect(todayControl).toHaveAttribute("aria-hidden", "true");
    await expect(todayControl.locator("time")).toHaveAttribute(
      "datetime",
      currentDateKey,
    );
    await expect(todayControl.locator("time")).toHaveText(
      formatFullDate(currentDateKey),
    );
    expect((await cards.first().boundingBox())!.width).toBeCloseTo(
      loadingWidth,
      0,
    );
    expect(await page.evaluate(() => ({
      cardDuration: getComputedStyle(document.querySelector<HTMLElement>("[data-day-card]")!).transitionDuration,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    }))).toEqual({ cardDuration: "0s", reducedMotion: true });
    await expect(dots.first().locator("span")).toHaveCSS("transition-duration", "0s");
    await expect(dateLines).toHaveText(expectedDateKeys.map(formatDate));
    expect(await dateLines.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("datetime"))
    )).toEqual(expectedDateKeys);
    await expect(carousel.locator(".day-card-relative-label")).toHaveText(
      [...relativeDayLabels],
    );
    await expect(dayHeadings).toHaveText(expectedDateKeys.map(formatDate));
    for (const [index, dateKey] of expectedDateKeys.entries()) {
      await expect(cards.nth(index)).toHaveAccessibleName(
        `${relativeDayLabels[index]}, ${formatFullDate(dateKey)}`,
      );
      await expect(eventRegions.nth(index)).toHaveAccessibleName(
        `${relativeDayLabels[index]} events`,
      );
      await expect(dots.nth(index)).toHaveAccessibleName(
        `Go to ${relativeDayLabels[index]}`,
      );
      await expect(dots.nth(index)).toHaveAttribute(
        "aria-controls",
        `day-card-${dateKey}`,
      );
      const controlledId = await dots.nth(index).getAttribute("aria-controls");
      const controlledCard = carousel.locator(
        `[data-day-card][id="${controlledId}"]`,
      );
      await expect(controlledCard).toHaveCount(1);
      await expect(controlledCard.locator(".day-card-date time")).toHaveAttribute(
        "datetime",
        dateKey,
      );
    }
    await expectActiveDay(page, 0);
    await expect(carousel.getByRole("button", { name: "Today", exact: true })).toHaveCount(0);
    await expect(carousel.getByRole("button", { name: "Go to Today", exact: true })).toHaveCount(1);

    const dateLine = getActiveCard(page).locator(".day-card-date time");
    const weekdayBox = (await dateLine.locator(".day-card-weekday").boundingBox())!;
    const calendarDateBox = (await dateLine.locator(".day-card-calendar-date").boundingBox())!;
    expect(calendarDateBox.y).toBeGreaterThan(weekdayBox.y + weekdayBox.height);
    await expect(dateLine.locator(".day-card-weekday")).toHaveCSS("font-weight", "700");
    await expect(getActiveCard(page).locator("header")).toHaveCount(1);
    await expect(getActiveCard(page).getByRole("heading", { level: 1 })).toHaveCount(0);
    const dateBox = (await dateLine.boundingBox())!;
    const eventsBox = (await getActiveCard(page).locator(".day-card-schedule").boundingBox())!;
    const outerBox = (await getActiveCard(page).boundingBox())!;
    expect(dateBox.y + dateBox.height).toBeLessThan(eventsBox.y);
    expect(dateBox.y + dateBox.height).toBeLessThan(outerBox.y + outerBox.height);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ivy Station");
    await expect(getActiveCard(page).getByRole("heading", { level: 3 })).toHaveText(
      agenda.events.filter((event) => event.dateKeys.includes(currentDateKey)).map((event) => event.title),
    );
    await page.getByRole("button", { name: "Open calendar", exact: true }).click();
    await expect(page.locator("iframe.calendar-frame")).toBeVisible();
    const renderStates: string[] = await page.evaluate(() => Reflect.get(window, "todayRenderStates"));
    expect(renderStates.some((state) => state.includes(formatDate(agenda.initialDateKey)))).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    releaseScripts();
  }
});

for (const width of [393, 1440]) {
test(`the current date scrubs from offstage without shifting the heading at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width < 600 ? 852 : 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const todayDateKey = getDateKey(snapshotDay(), agenda.timeZone);
  const todayControlName = `Return to Today, ${formatFullDate(todayDateKey)}`;
  await page.clock.setFixedTime(snapshotDay());
  await page.goto("ivy/");

  const carousel = getCarousel(page);
  const viewport = carousel.locator(".day-carousel-viewport");
  const todayControl = getTodayControl(page, todayDateKey);
  const headingSection = page.locator(".location-heading-section");
  const locationHeading = page.getByRole("heading", { level: 1 });
  await expect(carousel).toHaveAttribute("aria-busy", "false");
  await expect(todayControl).toHaveCount(1);
  await expect(todayControl).toHaveCSS("opacity", "0");
  await expect(todayControl).toHaveCSS("pointer-events", "none");
  await expect(todayControl).toBeDisabled();
  await expect(todayControl).toHaveAttribute("aria-hidden", "true");
  await expect(todayControl).toHaveAttribute("tabindex", "-1");
  await expect(page.getByRole("button", { name: todayControlName })).toHaveCount(0);
  const initialMotion = await getTodayControlMotion(page);
  const initialControlBox = (await todayControl.boundingBox())!;
  const initialViewportBox = (await viewport.boundingBox())!;
  expect(initialMotion.progress).toBeCloseTo(0, 3);
  expect(initialMotion.physicalProgress).toBeCloseTo(0, 3);
  expect(initialMotion.stageRight).toBeCloseTo(
    initialControlBox.x + initialControlBox.width,
    0,
  );
  await expect(todayControl).toHaveCSS("overflow-x", "clip");
  expect(initialMotion.dateLeft).toBeGreaterThanOrEqual(
    initialMotion.stageRight + 19,
  );
  if (width >= 1000) {
    expect(initialMotion.stageRight).toBeLessThan(
      initialMotion.viewportWidth - 100,
    );
    expect(initialMotion.dateLeft).toBeLessThan(initialMotion.viewportWidth);
    expect(
      initialViewportBox.x + initialViewportBox.width -
        initialMotion.stageRight,
    ).toBeCloseTo(32, 0);
    expect(initialMotion.travel).toBeLessThan(250);
  }

  const initialHeaderBox = (await headingSection.boundingBox())!;
  const initialHeadingBox = (await locationHeading.boundingBox())!;
  expect(initialMotion.stageRight).toBeCloseTo(
    initialHeaderBox.x + initialHeaderBox.width,
    0,
  );
  expect(
    initialMotion.travel - (initialMotion.dateRight - initialMotion.dateLeft),
  ).toBeGreaterThanOrEqual(19);
  expect(
    initialMotion.travel - (initialMotion.dateRight - initialMotion.dateLeft),
  ).toBeLessThanOrEqual(33);
  const initialControlLayout = await todayControl.evaluate((control) => ({
    height: (control as HTMLElement).offsetHeight,
    left: (control as HTMLElement).offsetLeft,
    width: (control as HTMLElement).offsetWidth,
  }));

  const snapDistance = await setTodayScrollProgress(page, 0.25);
  expect(snapDistance).toBeGreaterThan(0);
  await expect.poll(async () =>
    (await getTodayControlMotion(page)).progress
  ).toBeCloseTo(0.25, 2);
  let motion = await getTodayControlMotion(page);
  expect(motion.opacity).toBeCloseTo(0.25, 2);
  expect(motion.physicalProgress).toBeCloseTo(0.25, 2);
  expect(motion.direction).toBe("forward");
  expect(motion.translationX).toBeCloseTo(motion.travel * 0.75, 0);
  await expectActiveDay(page, 0);

  await setTodayScrollProgress(page, 0.5);
  await expect.poll(async () =>
    (await getTodayControlMotion(page)).progress
  ).toBeCloseTo(0.5, 2);
  motion = await getTodayControlMotion(page);
  const forwardHalfMotion = motion;
  expect(motion.opacity).toBeCloseTo(0.5, 2);
  expect(motion.physicalProgress).toBeCloseTo(0.5, 2);
  expect(motion.translationX).toBeCloseTo(motion.travel * 0.5, 0);
  await expect(todayControl).toBeEnabled();
  await expect(todayControl).toHaveAttribute("aria-hidden", "false");
  await expect(todayControl).toHaveAttribute("tabindex", "0");
  await expect(todayControl).toHaveCSS("pointer-events", "auto");
  await expect(page.getByRole("button", { name: todayControlName })).toHaveCount(1);

  await setTodayScrollProgress(page, 0.75);
  await expect.poll(async () =>
    (await getTodayControlMotion(page)).progress
  ).toBeCloseTo(0.75, 2);
  motion = await getTodayControlMotion(page);
  expect(motion.opacity).toBeCloseTo(0.75, 2);
  expect(motion.physicalProgress).toBeCloseTo(0.75, 2);
  await expectActiveDay(page, 1);

  await setTodayScrollProgress(page, 1.25);
  await expect.poll(async () =>
    (await getTodayControlMotion(page)).progress
  ).toBeCloseTo(1, 3);
  motion = await getTodayControlMotion(page);
  expect(motion.opacity).toBeCloseTo(1, 3);
  expect(motion.physicalProgress).toBeGreaterThanOrEqual(0.995);
  expect(motion.translationX).toBeCloseTo(0, 3);
  expect(motion.dateRight).toBeCloseTo(motion.stageRight, 0);
  expect(forwardHalfMotion.dateLeft).toBeCloseTo(
    (initialMotion.dateLeft + motion.dateLeft) / 2,
    0,
  );

  await todayControl.focus();
  await expect(todayControl).toBeFocused();
  await setTodayScrollProgress(page, 0.5);
  await expect.poll(async () =>
    (await getTodayControlMotion(page)).progress
  ).toBeCloseTo(0.5, 2);
  motion = await getTodayControlMotion(page);
  expect(motion.opacity).toBeCloseTo(0.5, 2);
  expect(motion.physicalProgress).toBeCloseTo(0.5, 2);
  expect(motion.direction).toBe("backward");
  expect(motion.translationX).toBeCloseTo(motion.travel * 0.5, 0);
  expect(motion.dateLeft).toBeCloseTo(forwardHalfMotion.dateLeft, 0);

  await setTodayScrollProgress(page, 0);
  await expect.poll(async () =>
    (await getTodayControlMotion(page)).progress
  ).toBeCloseTo(0, 3);
  await expect(todayControl).toBeDisabled();
  await expect(todayControl).toHaveAttribute("aria-hidden", "true");
  await expect(todayControl).toHaveCSS("pointer-events", "none");
  await expect(viewport).toBeFocused();
  await expect(page.getByRole("button", { name: todayControlName })).toHaveCount(0);
  motion = await getTodayControlMotion(page);
  expect(motion.dateLeft).toBeGreaterThanOrEqual(motion.stageRight + 19);
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  )).toBe(true);

  const finalHeaderBox = (await headingSection.boundingBox())!;
  const finalHeadingBox = (await locationHeading.boundingBox())!;
  const finalControlLayout = await todayControl.evaluate((control) => ({
    height: (control as HTMLElement).offsetHeight,
    left: (control as HTMLElement).offsetLeft,
    width: (control as HTMLElement).offsetWidth,
  }));
  expect(finalHeaderBox).toEqual(initialHeaderBox);
  expect(finalHeadingBox).toEqual(initialHeadingBox);
  expect(finalControlLayout).toEqual(initialControlLayout);
});
}

test("desktop arrows and day dots navigate without wrapping", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const todayDateKey = getDateKey(snapshotDay(), agenda.timeZone);
  await page.clock.setFixedTime(snapshotDay());
  await page.goto("ivy/");

  const carousel = getCarousel(page);
  const viewport = carousel.locator(".day-carousel-viewport");
  const previous = carousel.getByRole("button", { name: "Previous day" });
  const next = carousel.getByRole("button", { name: "Next day" });
  const dots = getDots(page);
  const todayControl = getTodayControl(page, todayDateKey);
  await expect(carousel).toHaveAttribute("aria-busy", "false");
  await expect(previous).toBeVisible();
  await expect(next).toBeVisible();
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  await expect(dots).toHaveCount(dayCardCount);
  await expectActiveDay(page, 0);
  await expect(todayControl).toHaveCSS("opacity", "0");
  await expect(todayControl).toBeDisabled();
  await expect(todayControl).toHaveAttribute("aria-hidden", "true");

  await viewport.focus();
  await page.keyboard.press("ArrowLeft");
  await expectActiveDay(page, 0);

  await page.keyboard.press("ArrowRight");
  await expectActiveDay(page, 1);
  await expectCenteredCard(page, 1);
  await expect(todayControl).toHaveCSS("opacity", "1");
  await expect(todayControl).toBeEnabled();
  await page.keyboard.press("ArrowLeft");
  await expectActiveDay(page, 0);
  await expectCenteredCard(page, 0);
  await expect(todayControl).toHaveCSS("opacity", "0");

  await next.focus();
  await page.keyboard.press("Enter");
  await expectActiveDay(page, 1);
  await expectCenteredCard(page, 1);
  await expect(previous).toBeEnabled();
  await expect(todayControl.locator("time")).toHaveAttribute(
    "datetime",
    todayDateKey,
  );
  await dots.nth(4).click();
  await expectActiveDay(page, 4);
  const futureScrollLeft = (await expectCenteredCard(page, 4)).scrollLeft;
  await expect(todayControl).toHaveCSS("opacity", "1");
  await todayControl.click();
  await expectActiveDay(page, 0);
  let returningMotion = await getTodayControlMotion(page);
  await expect.poll(async () => {
    returningMotion = await getTodayControlMotion(page);
    return returningMotion.opacity > 0.1 && returningMotion.opacity < 0.9;
  }).toBe(true);
  expect(returningMotion.scrollLeft).toBeGreaterThan(0);
  expect(returningMotion.scrollLeft).toBeLessThan(futureScrollLeft);
  expect(returningMotion.opacity).toBeCloseTo(
    returningMotion.progress,
    3,
  );
  await expectCenteredCard(page, 0);
  await expect(todayControl).toHaveCSS("opacity", "0");
  await expect(todayControl).toBeDisabled();
  await expect(viewport).toBeFocused();

  await next.click();
  await expectActiveDay(page, 1);
  await expectCenteredCard(page, 1);
  await todayControl.focus();
  await page.keyboard.press("Enter");
  await expectActiveDay(page, 0);
  await expectCenteredCard(page, 0);
  await expect(viewport).toBeFocused();

  await previous.focus();
  await page.keyboard.press("Space");
  await expectActiveDay(page, 0);

  for (let index = 1; index < dayCardCount; index++) {
    await next.click();
    await expectActiveDay(page, index);
    await expectCenteredCard(page, index);
  }
  await expect(next).toBeDisabled();
  await viewport.focus();
  await page.keyboard.press("ArrowRight");
  await expectActiveDay(page, dayCardCount - 1);

  await dots.nth(2).focus();
  await page.keyboard.press("Enter");
  await expectActiveDay(page, 2);
  await expectCenteredCard(page, 2);
  await dots.first().focus();
  await page.keyboard.press("Space");
  await expectActiveDay(page, 0);
  await expectCenteredCard(page, 0);
  await expect(previous).toBeDisabled();
  await expect(dots.first()).toBeFocused();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await dots.nth(3).click();
  await expectActiveDay(page, 3);
  expect((await getCarouselGeometry(page)).activeCenterError).toBeLessThan(2);
  await expect(todayControl).toBeEnabled();
  await expect(todayControl).toHaveCSS("opacity", "1");
  await todayControl.focus();
  await page.keyboard.press("Space");
  await expectActiveDay(page, 0);
  expect((await getCarouselGeometry(page)).activeCenterError).toBeLessThan(2);
  await expect(todayControl).toHaveCSS("opacity", "0");
  await expect(viewport).toBeFocused();
});

test("intentional carousel controls emit one privacy-safe analytics event", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installAnalyticsRecorder(page);
  await page.clock.setFixedTime(snapshotDay());
  await page.goto("ivy/");

  const carousel = getCarousel(page);
  const viewport = carousel.locator(".day-carousel-viewport");
  const previous = carousel.getByRole("button", { name: "Previous day" });
  const next = carousel.getByRole("button", { name: "Next day" });
  const todayDateKey = getDateKey(snapshotDay(), agenda.timeZone);
  const todayControl = getTodayControl(page, todayDateKey);
  await expect(carousel).toHaveAttribute("aria-busy", "false");
  await expect(previous).toBeDisabled();

  await viewport.evaluate((element) => {
    element.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(150);
  expect(await getAnalyticsEvents(page)).toEqual([]);

  await viewport.focus();
  await page.keyboard.press("ArrowLeft");
  await expectActiveDay(page, 0);
  await expect.poll(async () => (await getAnalyticsEvents(page)).length).toBe(1);

  await next.click();
  await expectActiveDay(page, 1);
  await expect.poll(async () => (await getAnalyticsEvents(page)).length).toBe(2);

  await previous.click();
  await expectActiveDay(page, 0);
  await expect.poll(async () => (await getAnalyticsEvents(page)).length).toBe(3);

  await viewport.focus();
  await page.keyboard.press("ArrowRight");
  await expectActiveDay(page, 1);
  await expect.poll(async () => (await getAnalyticsEvents(page)).length).toBe(4);

  await getDots(page).last().click();
  await expectActiveDay(page, dayCardCount - 1);
  await expect.poll(async () => (await getAnalyticsEvents(page)).length).toBe(5);

  await viewport.focus();
  await page.keyboard.press("ArrowRight");
  await expectActiveDay(page, dayCardCount - 1);
  await expect.poll(async () => (await getAnalyticsEvents(page)).length).toBe(6);

  await expect(todayControl).toBeEnabled();
  await todayControl.click();
  await expectActiveDay(page, 0);
  await expect.poll(async () => (await getAnalyticsEvents(page)).length).toBe(7);

  const events = await getAnalyticsEvents(page);
  expect(events.map(({ name }) => name)).toEqual([
    "carousel_boundary_attempt",
    "carousel_navigation",
    "carousel_navigation",
    "carousel_navigation",
    "carousel_navigation",
    "carousel_boundary_attempt",
    "carousel_navigation",
  ]);
  expect(events.map(({ parameters }) => parameters.interaction_method)).toEqual([
    "keyboard",
    "arrow",
    "arrow",
    "keyboard",
    "dot",
    "keyboard",
    "date_control",
  ]);
  expect(events[0].parameters).toMatchObject({
    attempted_direction: "backward",
    boundary: "start",
    current_index: 0,
    current_relative_label: "Today",
    interaction_source: "carousel_viewport",
    location_id: "ivy-station",
    visible_day_count: dayCardCount,
  });
  expect(events[1].parameters).toMatchObject({
    direction: "forward",
    from_index: 0,
    interaction_source: "next_arrow",
    to_index: 1,
  });
  expect(events[2].parameters).toMatchObject({
    direction: "backward",
    from_index: 1,
    interaction_source: "previous_arrow",
    to_index: 0,
  });
  expect(events[4].parameters).toMatchObject({
    direction: "forward",
    from_index: 1,
    interaction_source: "pagination_dot",
    to_index: dayCardCount - 1,
    to_relative_label: "In 6 days",
  });
  expect(events[5].parameters).toMatchObject({
    attempted_direction: "forward",
    boundary: "end",
    current_index: dayCardCount - 1,
  });
  expect(events[6].parameters).toMatchObject({
    direction: "backward",
    displayed_day: "In 6 days",
    from_index: dayCardCount - 1,
    interaction_source: "header_date_control",
    resulting_action: "return_to_today",
    to_index: 0,
  });

  const permittedParameterNames = new Set([
    "attempted_direction",
    "boundary",
    "current_date",
    "current_index",
    "current_relative_label",
    "direction",
    "displayed_date",
    "displayed_day",
    "from_date",
    "from_index",
    "from_relative_label",
    "interaction_method",
    "interaction_source",
    "location_id",
    "resulting_action",
    "to_date",
    "to_index",
    "to_relative_label",
    "visible_day_count",
  ]);
  for (const { parameters } of events) {
    expect(Object.keys(parameters).every((key) =>
      permittedParameterNames.has(key)
    )).toBe(true);
  }
});

test("desktop pointer dragging scrubs the rail and snaps to the nearest card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installAnalyticsRecorder(page);
  await page.clock.setFixedTime(snapshotDay());
  await page.goto("ivy/");

  const carousel = getCarousel(page);
  const viewport = carousel.locator(".day-carousel-viewport");
  const todayControl = page.locator(".location-today-control");
  await expect(carousel).toHaveAttribute("aria-busy", "false");
  await expectActiveDay(page, 0);
  await expectCenteredCard(page, 0);
  await expect(viewport).toHaveCSS("cursor", "grab");

  const box = (await viewport.boundingBox())!;
  const y = box.y + Math.min(box.height / 2, 120);
  const forwardStartX = box.x + box.width * 0.72;
  const forwardMiddleX = forwardStartX - box.width * 0.35;
  await page.mouse.move(forwardStartX, y);
  await page.mouse.down();
  await expect(viewport).toHaveAttribute("data-pointer-dragging", "true");
  await expect(viewport).toHaveCSS("cursor", "grabbing");
  await expect(viewport).toHaveCSS("user-select", "none");
  await page.mouse.move(forwardMiddleX, y, { steps: 5 });
  await expect.poll(async () =>
    (await getTodayControlMotion(page)).progress
  ).toBeGreaterThan(0.25);
  let motion = await getTodayControlMotion(page);
  expect(motion.progress).toBeLessThan(0.5);
  expect(motion.opacity).toBeCloseTo(motion.progress, 3);
  await expectActiveDay(page, 0);

  await page.mouse.move(box.x - 40, y, { steps: 5 });
  await expect.poll(async () =>
    (await getTodayControlMotion(page)).progress
  ).toBeGreaterThan(0.75);
  await page.mouse.up();
  await expect(viewport).not.toHaveAttribute("data-pointer-dragging", "true");
  await expect(viewport).toHaveCSS("cursor", "grab");
  await expectActiveDay(page, 1);
  await expectCenteredCard(page, 1);
  await expect(todayControl).toHaveCSS("opacity", "1");

  const backwardStartX = box.x + box.width * 0.28;
  await page.mouse.move(backwardStartX, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 40, y, { steps: 10 });
  await expect.poll(async () =>
    (await getTodayControlMotion(page)).progress
  ).toBeLessThan(0.35);
  motion = await getTodayControlMotion(page);
  expect(motion.progress).toBeGreaterThan(0);
  expect(motion.direction).toBe("backward");
  expect(motion.opacity).toBeCloseTo(motion.progress, 3);
  await page.mouse.up();
  await expectActiveDay(page, 0);
  await expectCenteredCard(page, 0);
  await expect(todayControl).toHaveCSS("opacity", "0");
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");

  await dispatchPenDrag(page, viewport, "left");
  await expectActiveDay(page, 1);
  await expectCenteredCard(page, 1);
  await expect(todayControl).toHaveCSS("opacity", "1");
  await dispatchPenDrag(page, viewport, "right");
  await expectActiveDay(page, 0);
  await expectCenteredCard(page, 0);
  await expect(todayControl).toHaveCSS("opacity", "0");
  const analyticsEvents = await getAnalyticsEvents(page);
  expect(analyticsEvents.map(({ name }) => name)).toEqual([
    "carousel_navigation",
    "carousel_navigation",
    "carousel_navigation",
    "carousel_navigation",
  ]);
  expect(analyticsEvents.map(({ parameters }) =>
    parameters.interaction_method
  )).toEqual([
    "mouse_drag",
    "mouse_drag",
    "pen_drag",
    "pen_drag",
  ]);
  expect(analyticsEvents.map(({ parameters }) => parameters.direction)).toEqual([
    "forward",
    "backward",
    "forward",
    "backward",
  ]);
});

test("pointer cancellation restores the origin and boundary analytics use the snap threshold", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installAnalyticsRecorder(page);
  await page.clock.setFixedTime(snapshotDay());
  await page.goto("ivy/");

  const carousel = getCarousel(page);
  const viewport = carousel.locator(".day-carousel-viewport");
  await expect(carousel).toHaveAttribute("aria-busy", "false");
  await expectActiveDay(page, 0);
  await expectCenteredCard(page, 0);

  const box = (await viewport.boundingBox())!;
  const cardStep = await viewport.evaluate((element) => {
    const cards = element.querySelectorAll<HTMLElement>("[data-day-card]");
    const first = cards.item(0).getBoundingClientRect();
    const second = cards.item(1).getBoundingClientRect();
    return second.left + second.width / 2 - (first.left + first.width / 2);
  });
  const y = box.y + Math.min(box.height / 2, 120);
  const cancelStartX = box.x + box.width * 0.72;
  await viewport.evaluate((element) => {
    element.addEventListener("pointerdown", (event) => {
      element.dataset.testPointerId = String(event.pointerId);
    }, { once: true });
  });
  await page.mouse.move(cancelStartX, y);
  await page.mouse.down();
  await page.mouse.move(cancelStartX - cardStep * 0.75, y, { steps: 6 });
  const pointerId = Number(await viewport.getAttribute("data-test-pointer-id"));
  await viewport.dispatchEvent("pointercancel", {
    button: 0,
    buttons: 0,
    clientX: cancelStartX - cardStep * 0.75,
    clientY: y,
    isPrimary: true,
    pointerId,
    pointerType: "mouse",
  });
  await page.mouse.up();
  await expectActiveDay(page, 0);
  await expectCenteredCard(page, 0);
  expect(await getAnalyticsEvents(page)).toEqual([]);

  const boundaryStartX = box.x + box.width * 0.25;
  const snapThreshold = cardStep / 2;
  await page.mouse.move(boundaryStartX, y);
  await page.mouse.down();
  await page.mouse.move(boundaryStartX + snapThreshold - 8, y, { steps: 4 });
  await page.mouse.up();
  await expectActiveDay(page, 0);
  await expectCenteredCard(page, 0);
  expect(await getAnalyticsEvents(page)).toEqual([]);

  await page.mouse.move(boundaryStartX, y);
  await page.mouse.down();
  await page.mouse.move(boundaryStartX + snapThreshold + 8, y, { steps: 4 });
  await page.mouse.up();
  await expectActiveDay(page, 0);
  await expectCenteredCard(page, 0);
  const events = await getAnalyticsEvents(page);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    name: "carousel_boundary_attempt",
    parameters: {
      attempted_direction: "backward",
      boundary: "start",
      current_index: 0,
      interaction_method: "mouse_drag",
    },
  });
});

test("the selected card stays aligned across responsive resizing", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.clock.setFixedTime(snapshotDay());
  await page.goto("ivy/");

  await getDots(page).nth(3).click();
  await expectActiveDay(page, 3);
  await expectCenteredCard(page, 3);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expectActiveDay(page, 3);
  await expectCenteredCard(page, 3);

  await page.setViewportSize({ width: 600, height: 900 });
  await expectActiveDay(page, 3);
  await expectCenteredCard(page, 3);
  await getDots(page).last().click();
  await expectActiveDay(page, dayCardCount - 1);
  await expectCenteredCard(page, dayCardCount - 1);
  await getDots(page).first().click();
  await expectActiveDay(page, 0);
  await expectCenteredCard(page, 0);
  await getDots(page).nth(3).click();
  await expectActiveDay(page, 3);
  await expectCenteredCard(page, 3);

  await page.setViewportSize({ width: 320, height: 900 });
  await expectActiveDay(page, 3);
  await expectCenteredCard(page, 3);
});

for (const width of [320, 1440]) {
  test(`equal-height cards cap and scroll Hawthorne's busy day at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(snapshotDay());
    await page.goto("hawthorne/");

    const carousel = getCarousel(page);
    const viewport = carousel.locator(".day-carousel-viewport");
    const cards = carousel.locator("[data-day-card]");
    const sparseCard = cards.nth(5);
    const busyCard = cards.nth(6);
    const sparseSchedule = sparseCard.locator(".day-card-schedule");
    const busySchedule = busyCard.locator(".day-card-schedule");
    const sparseScheduleFrame = sparseCard.locator(".day-card-schedule-frame");
    const busyScheduleFrame = busyCard.locator(".day-card-schedule-frame");
    const topFade = busyScheduleFrame.locator(".day-card-schedule-fade-top");
    const bottomFade = busyScheduleFrame.locator(
      ".day-card-schedule-fade-bottom",
    );
    await expect(carousel).toHaveAttribute("aria-busy", "false");
    await expect(cards).toHaveCount(dayCardCount);
    await expect(busySchedule).toHaveAttribute("data-overflow", "true");

    const cardHeights = await cards.evaluateAll((elements) =>
      elements.map((element) => (element as HTMLElement).offsetHeight)
    );
    expect(Math.max(...cardHeights) - Math.min(...cardHeights)).toBeLessThanOrEqual(1);
    expect(await sparseCard.evaluate((element) =>
      (element as HTMLElement).offsetHeight
    )).toBe(await busyCard.evaluate((element) =>
      (element as HTMLElement).offsetHeight
    ));

    await getDots(page).nth(5).click();
    await expectActiveDay(page, 5);
    await expectCenteredCard(page, 5);
    await expect(sparseSchedule).toHaveAttribute("data-overflow", "false");
    await expect(sparseScheduleFrame).toHaveAttribute("data-overflow", "false");
    await expect(sparseSchedule).not.toHaveAttribute("tabindex");
    await expect(sparseSchedule).not.toHaveAttribute("aria-describedby");
    await expect(sparseScheduleFrame.locator(
      ".day-card-schedule-fade",
    ).first()).toHaveCSS("opacity", "0");
    await expect(sparseScheduleFrame.locator(
      ".day-card-schedule-fade",
    ).last()).toHaveCSS("opacity", "0");
    const sparseOverflow = await sparseSchedule.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(sparseOverflow.scrollHeight).toBeLessThanOrEqual(
      sparseOverflow.clientHeight + 1,
    );

    await getDots(page).last().click();
    await expectActiveDay(page, dayCardCount - 1);
    await expectCenteredCard(page, dayCardCount - 1);
    await expect(busySchedule).toHaveAttribute("tabindex", "0");
    await expect(busySchedule).toHaveAttribute(
      "aria-label",
      "In 6 days events",
    );
    await expect(busySchedule).toHaveAttribute("aria-describedby", /.+/);
    await expect(busyScheduleFrame).toHaveAttribute("data-overflow", "true");
    await expect(busyScheduleFrame).toHaveAttribute("data-at-start", "true");
    await expect(busyScheduleFrame).toHaveAttribute("data-at-end", "false");
    await expect(topFade).toHaveCSS("opacity", "0");
    await expect(bottomFade).toHaveCSS("opacity", "1");
    await expect(topFade).toHaveCSS("pointer-events", "none");
    await expect(bottomFade).toHaveCSS("pointer-events", "none");
    const busyOverflow = await busySchedule.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(busyOverflow.clientHeight).toBeGreaterThanOrEqual(145);
    expect(busyOverflow.clientHeight).toBeLessThanOrEqual(147);
    expect(busyOverflow.scrollHeight).toBeGreaterThan(busyOverflow.clientHeight);

    const rowCue = await busySchedule.evaluate((element) => {
      const scheduleRect = element.getBoundingClientRect();
      const rows = [
        ...element.querySelectorAll<HTMLElement>(".day-card-event"),
      ].slice(0, 4).map((row) => {
        const rect = row.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          top: rect.top,
          visibleHeight: Math.max(
            0,
            Math.min(rect.bottom, scheduleRect.bottom) -
              Math.max(rect.top, scheduleRect.top),
          ),
        };
      });
      return {
        bottom: scheduleRect.bottom,
        rows,
        top: scheduleRect.top,
      };
    });
    expect(rowCue.rows).toHaveLength(4);
    for (const row of rowCue.rows.slice(0, 3)) {
      expect(row.top).toBeGreaterThanOrEqual(rowCue.top - 1);
      expect(row.bottom).toBeLessThanOrEqual(rowCue.bottom + 1);
    }
    expect(rowCue.rows[3].visibleHeight).toBeGreaterThan(4);
    expect(rowCue.rows[3].visibleHeight).toBeLessThan(
      rowCue.rows[3].height - 4,
    );

    const headingY = (await busyCard.locator(".day-card-heading").boundingBox())!.y;
    const railScrollLeft = await viewport.evaluate((element) => element.scrollLeft);
    await busySchedule.hover();
    await page.mouse.wheel(0, 120);
    await expect.poll(async () => busySchedule.evaluate((element) =>
      element.scrollTop
    )).toBeGreaterThan(0);
    await expect(busyScheduleFrame).toHaveAttribute("data-at-start", "false");
    await expect(busyScheduleFrame).toHaveAttribute("data-at-end", "false");
    await expect(topFade).toHaveCSS("opacity", "1");
    await expect(bottomFade).toHaveCSS("opacity", "1");
    await expectActiveDay(page, dayCardCount - 1);
    expect(await viewport.evaluate((element) => element.scrollLeft)).toBeCloseTo(
      railScrollLeft,
      0,
    );
    expect((await busyCard.locator(".day-card-heading").boundingBox())!.y).toBeCloseTo(
      headingY,
      0,
    );

    await busySchedule.evaluate((element) => { element.scrollTop = 0; });
    await busySchedule.focus();
    await expect(busySchedule).toBeFocused();
    await page.keyboard.press("PageDown");
    await expect.poll(async () => busySchedule.evaluate((element) =>
      element.scrollTop
    )).toBeGreaterThan(0);
    await expectActiveDay(page, dayCardCount - 1);
    expect((await busyCard.locator(".day-card-heading").boundingBox())!.y).toBeCloseTo(
      headingY,
      0,
    );

    await busySchedule.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(busyScheduleFrame).toHaveAttribute("data-at-start", "false");
    await expect(busyScheduleFrame).toHaveAttribute("data-at-end", "true");
    await expect(topFade).toHaveCSS("opacity", "1");
    await expect(bottomFade).toHaveCSS("opacity", "0");
    const finalRowVisibility = await busySchedule.evaluate((element) => {
      const scheduleRect = element.getBoundingClientRect();
      const finalRow = element.querySelector<HTMLElement>(
        ".day-card-event:last-child",
      );
      if (!finalRow) throw new Error("Busy schedule has no final event.");
      const finalRect = finalRow.getBoundingClientRect();
      return {
        finalBottom: finalRect.bottom,
        finalTop: finalRect.top,
        scheduleBottom: scheduleRect.bottom,
        scheduleTop: scheduleRect.top,
      };
    });
    expect(finalRowVisibility.finalTop).toBeGreaterThanOrEqual(
      finalRowVisibility.scheduleTop - 1,
    );
    expect(finalRowVisibility.finalBottom).toBeLessThanOrEqual(
      finalRowVisibility.scheduleBottom + 1,
    );

    if (width === 1440) {
      await busySchedule.evaluate((element) => { element.scrollTop = 0; });
      const scheduleBox = (await busySchedule.boundingBox())!;
      await page.mouse.move(
        scheduleBox.x + scheduleBox.width / 2,
        scheduleBox.y + scheduleBox.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        scheduleBox.x + scheduleBox.width + 320,
        scheduleBox.y + scheduleBox.height / 2 + 4,
        { steps: 10 },
      );
      await page.mouse.up();
      await expectActiveDay(page, 5);
      await expectCenteredCard(page, 5);
    }

    await page.goto("ivy/");
    const ivyCarousel = getCarousel(page);
    const ivyCards = ivyCarousel.locator("[data-day-card]");
    await expect(ivyCarousel).toHaveAttribute("aria-busy", "false");
    await expect(ivyCards).toHaveCount(dayCardCount);
    const ivySchedules = ivyCarousel.locator(".day-card-schedule");
    await expect(ivySchedules.first()).toHaveAttribute("data-overflow", "false");
    await expect(ivySchedules.first()).not.toHaveAttribute("tabindex");
    const ivyOverflowStates = await ivySchedules.evaluateAll((elements) =>
      elements.map((element) => ({
        clientHeight: element.clientHeight,
        overflows: (element as HTMLElement).dataset.overflow === "true",
        scrollHeight: element.scrollHeight,
        tabIndex: element.getAttribute("tabindex"),
      }))
    );
    for (const state of ivyOverflowStates) {
      if (state.overflows) {
        expect(state.scrollHeight).toBeGreaterThan(state.clientHeight + 1);
        expect(state.tabIndex).toBe("0");
      } else {
        expect(state.scrollHeight).toBeLessThanOrEqual(state.clientHeight + 1);
        expect(state.tabIndex).toBeNull();
      }
    }
    const ivyHeights = await ivyCards.evaluateAll((elements) =>
      elements.map((element) => (element as HTMLElement).offsetHeight)
    );
    expect(Math.max(...ivyHeights) - Math.min(...ivyHeights)).toBeLessThanOrEqual(1);
    await getDots(page).last().click();
    await expectActiveDay(page, dayCardCount - 1);
    await expectCenteredCard(page, dayCardCount - 1);
    const ivyViewport = ivyCarousel.locator(".day-carousel-viewport");
    await ivyViewport.focus();
    await page.keyboard.press("ArrowRight");
    await expectActiveDay(page, dayCardCount - 1);
    await expectCenteredCard(page, dayCardCount - 1);
  });
}

test.describe("touch day-card carousel", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 393, height: 852 },
  });

  test("swipes follow platform direction, stop at boundaries, and preserve a neighboring peek", async ({ page }) => {
    await installAnalyticsRecorder(page);
    await page.clock.setFixedTime(snapshotDay());
    await page.goto("ivy/");

    const carousel = getCarousel(page);
    const viewport = carousel.locator(".day-carousel-viewport");
    await expect(carousel).toHaveAttribute("aria-busy", "false");
    await expect(carousel.locator(".day-carousel-arrow-previous")).toBeHidden();
    await expect(carousel.locator(".day-carousel-arrow-next")).toBeHidden();
    await expect(getDots(page)).toHaveCount(dayCardCount);
    await expectActiveDay(page, 0);

    const firstGeometry = await expectCenteredCard(page, 0);
    expect(firstGeometry.scrollLeft).toBeLessThan(1);
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )).toBe(true);

    await dispatchTouchSwipe(page, viewport, "right");
    await expectActiveDay(page, 0);
    await expectCenteredCard(page, 0);
    await dispatchTouchSwipe(page, viewport, "left");
    await expectActiveDay(page, 1);
    await expectCenteredCard(page, 1);
    await dispatchTouchSwipe(page, viewport, "right");
    await expectActiveDay(page, 0);
    await expectCenteredCard(page, 0);

    await getDots(page).last().click();
    await expectActiveDay(page, dayCardCount - 1);
    const lastGeometry = await expectCenteredCard(page, dayCardCount - 1);
    expect(
      Math.abs(lastGeometry.scrollLeft - lastGeometry.maxScrollLeft),
    ).toBeLessThan(1);
    expect(
      Math.abs(
        firstGeometry.visibleWidths[1] -
          lastGeometry.visibleWidths[dayCardCount - 2],
      ),
    ).toBeLessThan(2);
    await dispatchTouchSwipe(page, viewport, "left");
    await expectActiveDay(page, dayCardCount - 1);
    await expectCenteredCard(page, dayCardCount - 1);

    const analyticsEvents = await getAnalyticsEvents(page);
    expect(analyticsEvents.map(({ name }) => name)).toEqual([
      "carousel_boundary_attempt",
      "carousel_navigation",
      "carousel_navigation",
      "carousel_navigation",
      "carousel_boundary_attempt",
    ]);
    expect(analyticsEvents.map(({ parameters }) =>
      parameters.interaction_method
    )).toEqual([
      "touch_swipe",
      "touch_swipe",
      "touch_swipe",
      "dot",
      "touch_swipe",
    ]);
    expect(analyticsEvents[0].parameters).toMatchObject({
      attempted_direction: "backward",
      boundary: "start",
      current_index: 0,
    });
    expect(analyticsEvents[4].parameters).toMatchObject({
      attempted_direction: "forward",
      boundary: "end",
      current_index: dayCardCount - 1,
    });
  });

  test("wide touch-first layouts keep swipe navigation while reserving horizontal drags", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.clock.setFixedTime(snapshotDay());
    await page.goto("ivy/");

    const carousel = getCarousel(page);
    const viewport = carousel.locator(".day-carousel-viewport");
    await expect(carousel).toHaveAttribute("aria-busy", "false");
    await expect(viewport).toHaveCSS("touch-action", "pan-y pinch-zoom");
    await expectActiveDay(page, 0);
    await dispatchTouchSwipe(page, viewport, "left");
    await expectActiveDay(page, 1);
    await expectCenteredCard(page, 1);
    await dispatchTouchSwipe(page, viewport, "right");
    await expectActiveDay(page, 0);
    await expectCenteredCard(page, 0);
  });

  test("a busy event region separates vertical scrolling from horizontal day swipes", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.clock.setFixedTime(snapshotDay());
    await page.goto("hawthorne/");

    const carousel = getCarousel(page);
    const viewport = carousel.locator(".day-carousel-viewport");
    await expect(carousel).toHaveAttribute("aria-busy", "false");
    await getDots(page).last().click();
    await expectActiveDay(page, dayCardCount - 1);
    await expectCenteredCard(page, dayCardCount - 1);

    let busySchedule = getActiveCard(page).locator(".day-card-schedule");
    await expect(busySchedule).toHaveAttribute("data-overflow", "true");
    await expect(busySchedule).toHaveCSS("touch-action", "pan-y pinch-zoom");
    const headingY = (
      await getActiveCard(page).locator(".day-card-heading").boundingBox()
    )!.y;
    const initialRailScrollLeft = await viewport.evaluate((element) =>
      element.scrollLeft
    );
    await dispatchTouchDrag(page, busySchedule, 24, -100);
    await expect.poll(async () => busySchedule.evaluate((element) =>
      element.scrollTop
    )).toBeGreaterThan(0);
    await expectActiveDay(page, dayCardCount - 1);
    expect(await viewport.evaluate((element) => element.scrollLeft)).toBeCloseTo(
      initialRailScrollLeft,
      0,
    );
    expect((
      await getActiveCard(page).locator(".day-card-heading").boundingBox()
    )!.y).toBeCloseTo(headingY, 0);

    await busySchedule.evaluate((element) => { element.scrollTop = 0; });
    await dispatchTouchPath(page, busySchedule, [
      { x: 4, y: -40 },
      { x: 180, y: -48 },
    ]);
    await expectActiveDay(page, dayCardCount - 1);
    await expectCenteredCard(page, dayCardCount - 1);

    await busySchedule.evaluate((element) => { element.scrollTop = 0; });
    await dispatchTouchDrag(page, busySchedule, 200, 8);
    await expectActiveDay(page, 5);
    await expectCenteredCard(page, 5);

    const sparseSchedule = getActiveCard(page).locator(".day-card-schedule");
    await expect(sparseSchedule).toHaveAttribute("data-overflow", "false");
    await dispatchTouchDrag(page, sparseSchedule, -200, 8);
    await expectActiveDay(page, dayCardCount - 1);
    await expectCenteredCard(page, dayCardCount - 1);

    busySchedule = getActiveCard(page).locator(".day-card-schedule");
    await dispatchTouchDrag(page, busySchedule, -200, 8);
    await expectActiveDay(page, dayCardCount - 1);
    await expectCenteredCard(page, dayCardCount - 1);
  });
});

for (const width of [1440, 600, 393, 320]) {
  test(`the carousel stays centered and wraps long schedules at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(snapshotDay());
    let eventCount = 1;
    await page.route("**/calendar-data/agendas.json", (route) => {
      const payload = Object.fromEntries(Object.entries(agendas).map(([id, source]) => {
        return [id, {
          ...source,
          generatedAt: new Date(Date.parse(source.generatedAt) + eventCount * 60_000).toISOString(),
          events: Array.from({ length: eventCount }, (_, index) => fixtureEvent(
            source.initialDateKey,
            `${id}-layout-event-${index}`,
            index === 0 ? "Community meetup" : index === 1
              ? "A community celebration with live music, local food, and a very long event name that needs to wrap"
              : "AReallyLongUnbrokenCommunityEventNameThatMustNeverEscapeTheCardBoundary",
            {
              allDay: index === 0,
              end: `${source.initialDateKey}T${index === 1 ? "17" : "20"}:00:00.000Z`,
              start: `${source.initialDateKey}T${index === 1 ? "16" : "18"}:00:00.000Z`,
            },
          )),
        }];
      }));
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(payload) });
    });
    for (const [slug, name] of [["ivy", "Ivy Station"], ["hawthorne", "Hawthorne"]]) {
      eventCount = 1;
      await page.goto(`${slug}/`);
      const carousel = getCarousel(page);
      const viewport = carousel.locator(".day-carousel-viewport");
      const card = getActiveCard(page);
      await expect(carousel).toHaveAttribute("aria-busy", "false");
      await expect(carousel.locator("[data-day-card]")).toHaveCount(dayCardCount);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("text-align", "left");
      await expect(card.getByRole("heading", { level: 1 })).toHaveCount(0);
      await expect(card.locator(".day-card-event h3")).toHaveText(["Community meetup"]);
      const compactBox = (await card.boundingBox())!;
      const carouselBox = (await carousel.boundingBox())!;
      const viewportBox = (await viewport.boundingBox())!;
      const locationBox = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      expect(carouselBox.y).toBeGreaterThan(locationBox.y + locationBox.height);
      const contentWidth = (await page.locator(".site-main-content").boundingBox())!.width;
      const expectedCarouselWidth = width < 704
        ? width
        : Math.min(contentWidth, 656);
      expect(Math.abs(carouselBox.width - expectedCarouselWidth)).toBeLessThan(1);
      expect(carouselBox.x + carouselBox.width / 2).toBeCloseTo(width / 2, 0);
      expect(viewportBox.x + viewportBox.width / 2).toBeCloseTo(width / 2, 0);
      expect(compactBox.x + compactBox.width / 2).toBeCloseTo(width / 2, 0);
      expect(compactBox.width).toBeLessThan(viewportBox.width);
      if (width < 552) {
        expect(compactBox.width / viewportBox.width).toBeGreaterThanOrEqual(0.89);
      } else {
        expect(compactBox.width).toBeCloseTo(512, 0);
      }
      const eventsBox = (await card.locator(".day-card-schedule").boundingBox())!;
      const dateBox = (await card.locator(".day-card-date").boundingBox())!;
      expect(eventsBox.y).toBeGreaterThan(dateBox.y + dateBox.height);
      const headingSectionBox = (
        await page.locator(".location-heading-section").boundingBox()
      )!;
      expect(headingSectionBox.x + headingSectionBox.width / 2).toBeCloseTo(
        carouselBox.x + carouselBox.width / 2,
        0,
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-weight", "300");
      await expect(card.locator(".day-card-weekday")).toHaveCSS("text-align", "left");
      await expect(card.locator(".day-card-calendar-date")).toHaveCSS("text-align", "left");
      await expect(card.locator(".day-card-event-time").first()).toHaveCSS(
        "color",
        await card.locator(".day-card-date").evaluate((element) => getComputedStyle(element).color),
      );

      const pagination = carousel.locator(".day-carousel-pagination");
      const paginationBox = (await pagination.boundingBox())!;
      const dotGeometry = await getDots(page).evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          const marker = element.firstElementChild!.getBoundingClientRect();
          return {
            height: box.height,
            left: box.left,
            markerCenter: marker.left + marker.width / 2,
            right: box.right,
            width: box.width,
          };
        })
      );
      expect(paginationBox.x + paginationBox.width / 2).toBeCloseTo(width / 2, 0);
      expect(paginationBox.width).toBeCloseTo(168, 0);
      expect(dotGeometry).toHaveLength(dayCardCount);
      for (const [index, box] of dotGeometry.entries()) {
        expect(box.width).toBeGreaterThanOrEqual(23.5);
        expect(box.height).toBeGreaterThanOrEqual(43.5);
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(width);
        if (index > 0) {
          expect(box.left).toBeGreaterThanOrEqual(
            dotGeometry[index - 1].right - 0.5,
          );
          expect(
            box.markerCenter - dotGeometry[index - 1].markerCenter,
          ).toBeCloseTo(24, 0);
        }
      }
      expect(
        dotGeometry.at(-1)!.markerCenter - dotGeometry[0].markerCenter,
      ).toBeLessThanOrEqual(width * 0.7);

      eventCount = 3;
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(card.locator(".day-card-event")).toHaveCount(3);
      await expect(card.locator(".day-card-event time")).toHaveText([
        "All day",
        "9:00–10:00 AM",
        "11:00 AM–1:00 PM",
      ]);
      expect((await card.boundingBox())!.width).toBeCloseTo(compactBox.width, 0);
      expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const listBox = (await card.locator(".day-card-event-list").boundingBox())!;
      const firstTitleBox = (await card.locator(".day-card-event h3").first().boundingBox())!;
      const timeLayout = await card.locator(".day-card-event time").evaluateAll(
        (elements) => elements.map((element) => {
          const box = element.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          const style = getComputedStyle(element);
          return {
            boxHeight: box.height,
            boxWidth: box.width,
            fontSize: Number.parseFloat(style.fontSize),
            lineHeight: Number.parseFloat(style.lineHeight),
            scrollWidth: element.scrollWidth,
            textWidth: range.getBoundingClientRect().width,
            whiteSpace: style.whiteSpace,
          };
        }),
      );
      expect(new Set(await card.locator(".day-card-event time").allTextContents()).size).toBe(3);
      const timeTrackWidth = Math.max(...timeLayout.map(({ boxWidth }) => boxWidth));
      const widestTimeText = Math.max(...timeLayout.map(({ textWidth }) => textWidth));
      expect(timeTrackWidth - widestTimeText).toBeLessThan(2);
      for (const time of timeLayout) {
        expect(time.boxHeight).toBeLessThanOrEqual(time.lineHeight + 1);
        expect(time.boxWidth).toBeCloseTo(timeTrackWidth, 1);
        expect(time.scrollWidth).toBeLessThanOrEqual(Math.ceil(time.boxWidth));
        expect(time.whiteSpace).toBe("nowrap");
        expect(time.fontSize).toBeCloseTo(12.5, 1);
      }
      const columnGap = await card.locator(".day-card-event-list").evaluate(
        (element) => Number.parseFloat(getComputedStyle(element).columnGap),
      );
      expect(timeTrackWidth + columnGap + firstTitleBox.width).toBeCloseTo(
        listBox.width,
        0,
      );
      expect(firstTitleBox.width).toBeGreaterThan(timeTrackWidth);
      expect(firstTitleBox.width / listBox.width).toBeGreaterThan(0.55);
      for (const event of await card.locator(".day-card-event").all()) {
        const title = (await event.locator("h3").boundingBox())!;
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
      await expect(card.locator(".day-card-relative-label")).toHaveText("Today");
      await page.getByRole("button", { name: "Open calendar", exact: true }).click();
      const calendarBox = (await page.locator("iframe.calendar-frame").boundingBox())!;
      const disclosureBox = (await page.locator(".calendar-disclosure").boundingBox())!;
      const fullCarouselBox = (await carousel.boundingBox())!;
      expect(calendarBox.y).toBeGreaterThan(fullCarouselBox.y + fullCarouselBox.height);
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
  await expect(getCarousel(page)).toHaveAttribute("aria-busy", "false");
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
  const todayDateKey = getDateKey(new Date(), agenda.timeZone);
  for (const [width, height] of [[320, 667], [393, 852], [430, 932], [600, 900], [393, 1200], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    for (const slug of ["ivy", "hawthorne"]) {
      await page.goto(`${slug}/`);
      await expect(getCarousel(page)).toHaveAttribute("aria-busy", "false");
      await expect(page.getByRole("contentinfo")).toHaveCount(1);
      const headingSection = page.locator(".location-heading-section");
      const locationHeading = page.getByRole("heading", { level: 1 });
      const todayControl = getTodayControl(page, todayDateKey);
      const todayWeekday = todayControl.locator(".location-today-weekday");
      const todayCalendarDate = todayControl.locator(
        ".location-today-calendar-date",
      );
      await expect(todayControl).toBeVisible();
      await expect(todayControl.locator("time")).toHaveAttribute(
        "datetime",
        todayDateKey,
      );
      const headingSectionBox = (await headingSection.boundingBox())!;
      const locationHeadingBox = (await locationHeading.boundingBox())!;
      const todayControlBox = (await todayControl.boundingBox())!;
      const todayWeekdayBox = (await todayWeekday.boundingBox())!;
      const todayCalendarDateBox = (await todayCalendarDate.boundingBox())!;
      expect(locationHeadingBox.x + locationHeadingBox.width).toBeLessThan(
        todayControlBox.x,
      );
      expect(todayControlBox.x + todayControlBox.width).toBeCloseTo(
        headingSectionBox.x + headingSectionBox.width,
        0,
      );
      expect(todayControlBox.height).toBeGreaterThanOrEqual(44);
      if (width < 384) {
        expect(todayCalendarDateBox.y).toBeGreaterThan(
          todayWeekdayBox.y + todayWeekdayBox.height - 1,
        );
      } else {
        expect(todayCalendarDateBox.y).toBeCloseTo(todayWeekdayBox.y, 0);
      }
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
        for (const selector of [".location-heading-section", ".day-card-section", ".calendar-disclosure", ".site-header-inner", ".site-footer-inner"]) {
          const box = (await page.locator(selector).boundingBox())!;
          expect(box.x + box.width / 2).toBeCloseTo(width / 2, 0);
        }
        const calendarControl = (await page.locator(".calendar-disclosure-toggle").boundingBox())!;
        const carousel = (await getCarousel(page).boundingBox())!;
        expect(calendarControl.x + calendarControl.width / 2).toBeCloseTo(carousel.x + carousel.width / 2, 0);
        expect(calendarControl.y - carousel.y - carousel.height).toBeCloseTo(32, 0);
        if (width < 704) {
          expect(carousel.width).toBeCloseTo(width, 0);
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

test("the seven-card window rolls over at Pacific midnight and keeps future empty and unavailable days visible", async ({ page }) => {
  // Intl derives the UTC offset for this date so the regression also runs in
  // winter and across daylight-saving changes without hardcoding PDT.
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: agenda.timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(pacificDay(currentDateKey)).find((part) => part.type === "timeZoneName")!.value.replace("GMT", "");
  const beforeMidnight = new Date(`${currentDateKey}T23:58:00${offset}`);
  const midnightEdge = new Date(`${currentDateKey}T23:59:59.900${offset}`);
  const nextDateKey = addDays(currentDateKey, 1);
  const deterministicAgenda: CalendarAgenda = {
    ...agenda,
    events: [
      fixtureEvent(currentDateKey, "rollover-today", "Deterministic today event"),
      fixtureEvent(nextDateKey, "rollover-tomorrow", "Deterministic tomorrow event"),
    ],
    generatedAt: new Date(Date.parse(agenda.generatedAt) + 60_000).toISOString(),
  };
  await page.route("**/calendar-data/agendas.json", (route) => route.fulfill({
    body: JSON.stringify({ ...agendas, "ivy-station": deterministicAgenda }),
    contentType: "application/json",
  }));
  await page.clock.install({ time: beforeMidnight });
  await page.goto("ivy/");
  const carousel = getCarousel(page);
  const cards = carousel.locator("[data-day-card]");
  const dateLines = cards.locator(".day-card-date time");
  await expect(carousel).toHaveAttribute("aria-busy", "false");
  await expect(cards).toHaveCount(dayCardCount);
  expect(await dateLines.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("datetime"))
  )).toEqual(getDayCardDateKeys(currentDateKey));
  await expect(carousel.locator(".day-card-relative-label")).toHaveText(
    [...relativeDayLabels],
  );
  const todayControl = page.locator(".location-today-control");
  await expect(todayControl).toHaveAttribute(
    "aria-label",
    `Return to Today, ${formatFullDate(currentDateKey)}`,
  );
  await expect(todayControl.locator("time")).toHaveAttribute(
    "datetime",
    currentDateKey,
  );
  await expectActiveDay(page, 0);
  await expect(getActiveCard(page).getByRole("heading", { level: 3 })).toHaveText(
    ["Deterministic today event"],
  );

  await page.clock.setSystemTime(midnightEdge);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(todayControl.locator("time")).toHaveAttribute(
    "datetime",
    currentDateKey,
  );
  await page.clock.runFor(200);
  await expect.poll(() => dateLines.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("datetime"))
  )).toEqual(getDayCardDateKeys(nextDateKey));
  await expect(cards).toHaveCount(dayCardCount);
  await expectActiveDay(page, 0);
  await expect(todayControl).toHaveAttribute(
    "aria-label",
    `Return to Today, ${formatFullDate(nextDateKey)}`,
  );
  await expect(todayControl.locator("time")).toHaveAttribute(
    "datetime",
    nextDateKey,
  );
  await expect(todayControl.locator("time")).toHaveText(
    formatFullDate(nextDateKey),
  );
  await expect(getActiveCard(page).getByRole("heading", { level: 3 })).toHaveText(
    ["Deterministic tomorrow event"],
  );

  const emptyWindowStart = addDays(currentDateKey, 2);
  const emptyDateKeys = getDayCardDateKeys(emptyWindowStart);
  const emptyIndex = 1;
  await page.clock.setSystemTime(pacificDay(emptyWindowStart));
  await page.clock.runFor(60_000);
  await expect.poll(() => dateLines.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("datetime"))
  )).toEqual(emptyDateKeys);
  await getDots(page).nth(emptyIndex).click();
  await expectActiveDay(page, emptyIndex);
  await expect(getActiveCard(page).locator(".day-card-message")).toHaveText(
    emptyIndex === 1
      ? "Nothing is scheduled for tomorrow."
      : "Nothing is scheduled for this day.",
  );
  await expect(cards).toHaveCount(dayCardCount);

  const lastDateKey = agenda.availableDateKeys.at(-1)!;
  const expiredDateKey = addDays(lastDateKey, 1);
  await page.clock.setSystemTime(pacificDay(expiredDateKey));
  await page.clock.runFor(60_000);
  await expect.poll(() => dateLines.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("datetime"))
  )).toEqual(getDayCardDateKeys(expiredDateKey));
  await expect(cards).toHaveCount(dayCardCount);
  await expectActiveDay(page, 0);
  await expect(getActiveCard(page).locator(".day-card-message")).toHaveText(
    "Today's schedule is unavailable.",
  );
  expect(await cards.locator(".day-card-message").allTextContents()).toEqual([
    "Today's schedule is unavailable.",
    ...Array.from(
      { length: dayCardCount - 1 },
      () => "This day's schedule is unavailable.",
    ),
  ]);
  await expect(getCarousel(page).getByText(
    "Schedules are temporarily unavailable. The full calendar is still available below.",
    { exact: true },
  )).toBeVisible();
  await expect(cards.locator(".day-card-event")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ivy Station");
  await expect(page.getByRole("heading", { name: "Full calendar" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open calendar", exact: true }).click();
  await expect(page.locator("iframe.calendar-frame")).toHaveAttribute("title", "Ivy Station Calendar");
  await expect(page.locator("iframe.calendar-frame")).toBeVisible();
});
