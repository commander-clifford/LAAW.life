import { expect, test, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";

const googleCalendarPattern = "https://calendar.google.com/**";

async function fulfillCalendarFixture(route: Route): Promise<void> {
  await route.fulfill({
    body: "<!doctype html><title>Calendar fixture</title><p>Calendar fixture</p>",
    contentType: "text/html",
    status: 200,
  });
}

async function expectPageInteractionState(page: Page, drawerOpen: boolean): Promise<void> {
  await expect.poll(() => page.evaluate((isOpen) => {
    const surfaces = [...document.querySelectorAll<HTMLElement>("[data-page-interaction-surface]")];
    return surfaces.length > 0 && surfaces.every((surface) => surface.inert === isOpen);
  }, drawerOpen)).toBe(true);
  await expect.poll(() => page.evaluate(() => [
    document.body.style.overflow,
    document.documentElement.style.overflow,
  ])).toEqual(drawerOpen ? ["hidden", "hidden"] : ["", ""]);
}

async function expectClosedNavigationLayout(page: Page, viewportWidth: number): Promise<void> {
  const opener = page.getByRole("button", { name: "Open location navigation" });
  const drawer = page.locator("#location-drawer");
  const main = page.getByRole("main");
  const content = page.locator(".site-main-content");
  const calendar = page.locator("iframe.calendar-frame");
  const card = page.locator(".daily-information-card");

  await expect(opener).toBeVisible();
  await expect(opener).toBeEnabled();
  await expect(opener).toHaveAttribute("aria-expanded", "false");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
  await expect(drawer).toHaveJSProperty("inert", true);
  await expect(drawer).not.toBeInViewport();
  await expect(page.locator(".site-navigation")).not.toHaveAttribute("aria-modal", "true");
  await expectPageInteractionState(page, false);
  if (await page.getByRole("button", { name: "Open calendar", exact: true }).isVisible()) {
    await page.getByRole("button", { name: "Open calendar", exact: true }).click();
  }
  await expect(calendar).toBeVisible();
  await expect(card.locator(".today-schedule-date time")).toBeVisible();

  const mainBox = (await main.boundingBox())!;
  const contentBox = (await content.boundingBox())!;
  const calendarBox = (await calendar.boundingBox())!;
  const cardBox = (await card.boundingBox())!;
  const dateBox = (await card.locator(".today-schedule-date").boundingBox())!;
  const eventsBox = (await card.getByRole("region", { name: "Daily events" }).boundingBox())!;
  const layoutWidth = await page.evaluate(() => document.documentElement.clientWidth);

  // A closed drawer must reserve no sidebar space, including above 1024px.
  expect(Math.abs(mainBox.x)).toBeLessThan(1);
  expect(Math.abs(mainBox.width - layoutWidth)).toBeLessThan(1);
  expect(Math.abs(contentBox.x + contentBox.width / 2 - layoutWidth / 2)).toBeLessThan(1);
  expect(Math.abs(cardBox.x - contentBox.x)).toBeLessThan(1);
  expect(Math.abs(calendarBox.x - contentBox.x)).toBeLessThan(1);
  expect(calendarBox.width).toBeCloseTo(Math.min(800, contentBox.width - 48), 0);
  expect(calendarBox.height).toBeLessThanOrEqual(448);
  expect(cardBox.x).toBeGreaterThanOrEqual(0);
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewportWidth);
  expect(calendarBox.y).toBeGreaterThan(cardBox.y + cardBox.height);
  const titleBox = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
  expect(dateBox.y).toBeGreaterThan(titleBox.y + titleBox.height);
  expect(eventsBox.y).toBeGreaterThan(dateBox.y + dateBox.height);
}

test.beforeEach(async ({ page }) => {
  await page.route(googleCalendarPattern, fulfillCalendarFixture);
});

test("the home redirect preserves traffic-source parameters", async ({ page }) => {
  await page.goto("./?utm_source=newsletter&utm_medium=email&utm_campaign=calendar");
  await expect(page).toHaveURL(/\/ivy\/\?utm_source=newsletter&utm_medium=email&utm_campaign=calendar$/);
});

test("the drawer opens the unchanged original site", async ({ page }) => {
  await page.goto("ivy/");
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await page.getByRole("button", { name: "Open location navigation" }).click();
  const originalLink = page.getByRole("navigation", { name: "Location calendars" }).getByRole("link", { name: "OG Regular", exact: true });
  await originalLink.click();
  await expect(page).toHaveURL(/\/og\/$/);
  await expect(page.locator("iframe")).toHaveCount(2);
  await expect(page.locator(".site-header, .site-footer, script[src*='_next']")).toHaveCount(0);
  const response = await page.request.get(page.url());
  expect(await response.text()).toBe(readFileSync(new URL("../public/og/index.html", import.meta.url), "utf8"));
});

test("the location drawer uses grayscale state and destination icons", async ({ page }) => {
  await page.goto("hawthorne/");
  await page.getByRole("button", { name: "Open location navigation" }).click();

  const drawer = page.getByRole("navigation", { name: "Location calendars" });
  const current = drawer.getByRole("link", { name: "Hawthorne", exact: true });
  const locationLinks = drawer.locator(".location-link");
  const original = drawer.getByRole("link", { name: "OG Regular", exact: true });

  await expect(locationLinks).toHaveCount(2);
  await expect(locationLinks.locator("svg")).toHaveCount(2);
  await expect(original.locator("svg")).toHaveCount(1);
  await expect(current).toHaveCSS("text-decoration-line", "none");
  await expect(original).toHaveCSS("text-decoration-line", "none");

  const selectedStyles = await current.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      background: styles.backgroundColor,
      border: styles.borderColor,
      color: styles.color,
    };
  });
  expect(selectedStyles.background).toBe("rgb(244, 244, 244)");
  expect(selectedStyles.border).toBe("rgba(0, 0, 0, 0)");
  expect(selectedStyles.color).toBe("rgb(25, 25, 25)");
});

test("a first-time visitor can switch locations, return to the saved route, and go back", async ({ page }) => {
  test.slow();
  await page.unroute(googleCalendarPattern);
  const pendingCalendarRoutes: Route[] = [];
  await page.route(googleCalendarPattern, (route) => {
    pendingCalendarRoutes.push(route);
  });

  await page.goto("./", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/ivy\/$/);
  await expect(page).toHaveTitle("Ivy Station Calendar | LAAW Life");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "View the Ivy Station calendar for LAAW Life.",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ivy Station");
  await expect(page.locator(".site-header")).not.toContainText("Ivy Station");
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Ivy Station");
  await expect(
    page.getByRole("heading", { level: 2, name: "Full calendar" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Open calendar", exact: true }).click();
  const calendarFrame = page.locator("iframe.calendar-frame");
  await expect(calendarFrame).toHaveCount(1);
  await expect(calendarFrame).toHaveAttribute("title", "Ivy Station Calendar");
  await expect(page.getByText("The calendar is taking longer than expected.")).toBeVisible({
    timeout: 12_000,
  });
  await expect(page.locator(".calendar-shell")).toHaveAttribute("aria-busy", "false");
  await expect(
    page.getByRole("link", { name: "Open the calendar in a new tab" }),
  ).toHaveCount(0);

  const firstFrame = await calendarFrame.elementHandle();
  const reloadButton = page.getByRole("button", { name: "Reload calendar" });
  await reloadButton.click();
  await expect(page.getByText("Loading calendar…")).toBeVisible();
  await expect.poll(() => pendingCalendarRoutes.length).toBe(2);
  await expect
    .poll(() => firstFrame?.evaluate((frame) => frame.isConnected))
    .toBe(false);

  await Promise.all(
    pendingCalendarRoutes.map(async (route) => {
      try {
        await fulfillCalendarFixture(route);
      } catch {
        // The first navigation is canceled when Retry replaces the iframe.
      }
    }),
  );
  await expect(page.locator(".calendar-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );

  await page.unroute(googleCalendarPattern);
  await page.route(googleCalendarPattern, fulfillCalendarFixture);

  await calendarFrame.dispatchEvent("error", { bubbles: true });
  await expect(page.getByText("The embedded calendar could not load.")).toBeVisible();
  await expect(page.locator(".calendar-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(
    page.getByRole("link", { name: "Open the calendar in a new tab" }),
  ).toHaveCount(0);
  await expect(reloadButton).toBeVisible();

  await page.unroute(googleCalendarPattern);
  const hawthorneCalendarRoutes: Route[] = [];
  await page.route(googleCalendarPattern, (route) => {
    hawthorneCalendarRoutes.push(route);
  });
  await page.getByRole("button", { name: "Open location navigation" }).click();
  await page.getByRole("navigation", { name: "Location calendars" }).getByRole("link", { name: "Hawthorne" }).click();

  await expect(page).toHaveURL(/\/hawthorne\/$/);
  await expect(page).toHaveTitle("Hawthorne Calendar | LAAW Life");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "View the Hawthorne calendar for LAAW Life.",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hawthorne");
  await expect(page.locator(".site-header")).not.toContainText("Hawthorne");
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByRole("button", { name: "Open calendar", exact: true }).click();
  await expect(page.getByText("Loading calendar…")).toBeVisible();
  await expect(page.locator("iframe.calendar-frame")).toBeVisible();
  await expect.poll(() => hawthorneCalendarRoutes.length).toBe(1);
  await fulfillCalendarFixture(hawthorneCalendarRoutes[0]);
  await expect(page.locator(".calendar-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator("iframe.calendar-frame")).toBeVisible();
  await expectPageInteractionState(page, false);

  await page.unroute(googleCalendarPattern);
  await page.route(googleCalendarPattern, fulfillCalendarFixture);
  const savedLocationURL = page.url();
  await Promise.all([
    page.waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame() && frame.url() === savedLocationURL,
    }),
    page.getByRole("link", { name: "LAAW.life", exact: true }).click(),
  ]);
  await expect(page).toHaveURL(/\/hawthorne\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hawthorne");

  // The root redirect replaces its history entry; Back must not keep reopening it.
  await page.goBack();
  await expect(page).toHaveURL(/\/hawthorne\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/ivy\/$/);

  // Returning to a different location makes it the next starting page.
  await page.goto("ivy/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ivy Station");
  await expect.poll(() => page.evaluate(() =>
    window.localStorage.getItem("laaw-life:laaw-life:last-location:v1"),
  )).toBe("ivy-station");
  await page.goto("./");
  await expect(page).toHaveURL(/\/ivy\/$/);
});

test("navigation automatically remembers the last destination after reopening, including OG Regular", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 667 });
  await page.goto("ivy/");
  const opener = page.getByRole("button", { name: "Open location navigation" });
  await opener.click();
  const drawer = page.locator("#location-drawer");
  const original = drawer.getByRole("link", { name: "OG Regular", exact: true });
  await expect(drawer.getByRole("link")).toHaveCount(3);
  await expect(drawer.getByRole("radio")).toHaveCount(0);
  await expect(drawer).not.toContainText("Start here next time");
  await expect(drawer).not.toContainText("Current");
  await expect(drawer.getByRole("link", { name: "Ivy Station", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(original).toHaveAttribute("href", /\/og\/$/);
  const hawthorneBox = (await drawer.getByRole("link", { name: "Hawthorne", exact: true }).boundingBox())!;
  expect((await original.boundingBox())!.y).toBeGreaterThan(hawthorneBox.y + hawthorneBox.height + 20);
  expect(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await drawer.getByRole("link", { name: "Hawthorne", exact: true }).click();
  await expect(page).toHaveURL(/\/hawthorne\/$/);
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem("laaw-life:laaw-life:last-location:v1"),
  )).toBe("hawthorne");

  const returning = await context.newPage();
  await returning.route(googleCalendarPattern, fulfillCalendarFixture);
  await page.close();
  await returning.goto("./");
  await expect(returning).toHaveURL(/\/hawthorne\/$/);
  await returning.getByRole("button", { name: "Open location navigation" }).click();
  await returning.getByRole("link", { name: "OG Regular", exact: true }).click();
  await expect(returning).toHaveURL(/\/og\/$/);
  await returning.goto("./?utm_source=remember-test#calendar");
  await expect(returning).toHaveURL(/\/og\/\?utm_source=remember-test#calendar$/);
  await expect(returning.locator("iframe")).toHaveCount(2);
  await returning.goto("ivy/");
  await expect.poll(() => returning.evaluate(() =>
    localStorage.getItem("laaw-life:laaw-life:last-location:v1"),
  )).toBe("ivy-station");
  await returning.goto("./");
  await expect(returning).toHaveURL(/\/ivy\/$/);
});

test("blocked storage does not prevent navigation or add preference controls", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() { throw new DOMException("Storage is blocked", "SecurityError"); },
    });
  });
  await page.goto("ivy/");
  await page.getByRole("button", { name: "Open location navigation" }).click();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Location calendars" }).getByRole("link", { name: "Hawthorne", exact: true }).click();
  await expect(page).toHaveURL(/\/hawthorne\/$/);
  await page.goto("./");
  await expect(page).toHaveURL(/\/ivy\/$/);
  expect(errors).toEqual([]);
});

test("a returning visitor reaches the saved location", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "laaw-life:laaw-life:last-location:v1",
      "hawthorne",
    );
  });

  await page.goto("./");

  await expect(page).toHaveURL(/\/hawthorne\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Hawthorne" }),
  ).toBeVisible();
});

for (const storageState of ["invalid", "blocked"] as const) {
  test(`the root falls back to Ivy when saved storage is ${storageState}`, async ({ page }) => {
    await page.addInitScript((state) => {
      if (state === "invalid") {
        window.localStorage.setItem("laaw-life:laaw-life:last-location:v1", "missing-location");
      } else {
        Object.defineProperty(window, "localStorage", {
          get() { throw new DOMException("Storage is blocked", "SecurityError"); },
        });
      }
    }, storageState);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("./");
    await expect(page).toHaveURL(/\/ivy\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ivy Station");
    await expect(page.getByRole("button", { name: "Open location navigation" })).toBeEnabled();
    expect(errors).toEqual([]);
  });
}

for (const [device, width] of [["mobile", 320], ["tablet", 768], ["desktop", 1440]] as const) {
  test(`${device} navigation traps focus, dismisses, and restores the correct target`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("ivy/");

    const opener = page.getByRole("button", { name: "Open location navigation" });
    const drawer = page.locator("#location-drawer");
    const close = page.getByRole("button", { name: "Close location navigation" });
    const current = drawer.getByRole("link", { name: /Ivy Station/ });
    const hawthorne = drawer.getByRole("link", { name: "Hawthorne" });
    await expect(opener).toBeVisible();
    await expect(opener).toBeEnabled();
    await expect(opener).toHaveAttribute("aria-haspopup", "dialog");
    await expect(drawer).toHaveAttribute("aria-hidden", "true");

    await opener.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Location navigation", exact: true })).toHaveAttribute("aria-modal", "true");
    await expect(drawer.getByRole("button", { name: "Close location navigation" })).toHaveCount(0);
    await expect(drawer.getByRole("heading")).toHaveCount(0);
    await expect(current).toHaveAttribute("aria-current", "page");
    await expect(close).toBeFocused();
    await expectPageInteractionState(page, true);
    if (width !== 768) {
      await expect.poll(async () => {
        const bounds = (await drawer.boundingBox())!;
        return Math.abs(bounds.x + bounds.width - width);
      }).toBeLessThan(1);
      const screenshotPath = testInfo.outputPath(`drawer-${width}.png`);
      await page.screenshot({ path: screenshotPath });
      await testInfo.attach("drawer", { path: screenshotPath, contentType: "image/png" });
    }

    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("link", { name: "LAAW.life", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(current).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
    await expect(drawer).toHaveAttribute("aria-hidden", "true");
    await expectPageInteractionState(page, false);

    await opener.click();
    await current.click();
    await expect(page).toHaveURL(/\/ivy\/$/);
    await expect(opener).toBeFocused();
    await expect(drawer).toHaveAttribute("aria-hidden", "true");

    await opener.click();
    await page.locator(".drawer-overlay").click({ position: { x: 8, y: 100 } });
    await expect(opener).toBeFocused();
    await expect(drawer).toHaveAttribute("aria-hidden", "true");
    await expectPageInteractionState(page, false);

    await opener.click();
    await expect(close).toBeFocused();
    await hawthorne.focus();
    await expect(hawthorne).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/hawthorne\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hawthorne");
    await expect(page.locator(".site-header")).not.toContainText("Hawthorne");
    await expect(drawer).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("main")).toBeFocused();
    await expectPageInteractionState(page, false);
    await expect(page.locator(".drawer-overlay")).toHaveCSS("pointer-events", "none");
    await expect(page.getByRole("heading", { name: "Today", exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Daily events" })).toBeVisible();
  });
}

test("drawer state survives resizing and closed content uses the full width", async ({ page }) => {
  await page.setViewportSize({ width: 1023, height: 900 });
  await page.goto("ivy/");

  const opener = page.getByRole("button", { name: "Open location navigation" });
  const drawer = page.locator("#location-drawer");
  const appearance = drawer.getByLabel("Appearance");
  await expectClosedNavigationLayout(page, 1023);
  await opener.click();
  await expect(page.getByRole("button", { name: "Close location navigation" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("link", { name: "LAAW.life", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");

  for (const width of [1024, 1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
    await expect(page.getByRole("dialog", { name: "Location navigation", exact: true })).toHaveAttribute("aria-modal", "true");
    await expect(drawer).toHaveJSProperty("inert", false);
    await expect(drawer).toBeInViewport();
    const header = (await page.locator(".site-header").boundingBox())!;
    expect((await drawer.boundingBox())!.y).toBeCloseTo(header.y + header.height, 0);
    await expect(appearance).toBeFocused();
    await expect(page.getByRole("button", { name: "Close location navigation" })).toBeEnabled();
    await expectPageInteractionState(page, true);
  }

  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await expectClosedNavigationLayout(page, 320);
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(opener).toBeFocused();
    await expectClosedNavigationLayout(page, width);
  }
});

for (const width of [320, 1440]) {
  test(`the header stays fixed and the same button closes the drawer after scrolling at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 667 });
    await page.emulateMedia({ reducedMotion: width === 320 ? "reduce" : "no-preference" });
    await page.goto("hawthorne/");
    await page.getByRole("button", { name: "Open calendar", exact: true }).click();
    await expect(page.locator(".calendar-shell")).toHaveAttribute("aria-busy", "false");
    await page.evaluate(() => window.scrollTo(0, 300));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    const scrollPosition = await page.evaluate(() => scrollY);
    const header = page.locator(".site-header");
    const toggle = page.locator(".navigation-toggle");
    const drawer = page.locator("#location-drawer");
    const headerBefore = (await header.boundingBox())!;
    const toggleBefore = (await toggle.boundingBox())!;
    expect(headerBefore.y).toBe(0);

    await toggle.click();
    await expect(toggle).toHaveAccessibleName("Close location navigation");
    await expect(toggle).toBeEnabled();
    await expect(toggle).toBeFocused();
    await expect.poll(async () => {
      const bounds = (await drawer.boundingBox())!;
      return bounds.x + bounds.width;
    }).toBeCloseTo(width, 0);
    expect(await header.boundingBox()).toEqual(headerBefore);
    expect(await toggle.boundingBox()).toEqual(toggleBefore);
    const drawerBox = (await drawer.boundingBox())!;
    expect(drawerBox.y).toBeCloseTo(headerBefore.height, 0);
    expect(drawerBox.y + drawerBox.height).toBeCloseTo(667, 0);
    await expect(drawer.getByRole("button", { name: "Close location navigation" })).toHaveCount(0);
    await expect.poll(() => toggle.locator(".navigation-toggle-line-middle").evaluate((stroke) =>
      new DOMMatrix(getComputedStyle(stroke).transform).a,
    )).toBeCloseTo(0, 3);
    const icon = (await toggle.locator("svg").boundingBox())!;
    for (const selector of [".navigation-toggle-line-top", ".navigation-toggle-line-bottom"]) {
      const stroke = (await toggle.locator(selector).boundingBox())!;
      expect(stroke.x + stroke.width / 2).toBeCloseTo(icon.x + icon.width / 2, 1);
      expect(stroke.y + stroke.height / 2).toBeCloseTo(icon.y + icon.height / 2, 1);
      expect(stroke.width).toBeCloseTo(stroke.height, 1);
    }
    await page.screenshot({ path: testInfo.outputPath(`fixed-header-drawer-${width}.png`) });

    await toggle.click();
    await expect(toggle).toHaveAccessibleName("Open location navigation");
    await expect(drawer).toHaveAttribute("aria-hidden", "true");
    expect(await page.evaluate(() => scrollY)).toBe(scrollPosition);
    expect(await header.boundingBox()).toEqual(headerBefore);
    await expectPageInteractionState(page, false);
    await expect.poll(() => toggle.locator(".navigation-toggle-line-middle").evaluate((stroke) =>
      new DOMMatrix(getComputedStyle(stroke).transform).a,
    )).toBeCloseTo(1, 3);
  });
}

test("menu strokes, drawer, page, and overlay stay synchronized through opening, closing, and reversal", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("ivy/");
  await expect(page.getByRole("button", { name: "Open location navigation" })).toBeEnabled();

  const recordings = await page.evaluate(async () => {
    const toggle = document.querySelector<HTMLButtonElement>(".navigation-toggle")!;
    const drawer = document.querySelector<HTMLElement>(".location-drawer")!;
    const main = document.querySelector<HTMLElement>(".site-main")!;
    const overlay = document.querySelector<HTMLElement>(".drawer-overlay")!;
    const top = toggle.querySelector<SVGLineElement>(".navigation-toggle-line-top")!;
    const middle = toggle.querySelector<SVGLineElement>(".navigation-toggle-line-middle")!;
    const bottom = toggle.querySelector<SVGLineElement>(".navigation-toggle-line-bottom")!;
    const matrix = (element: Element) => new DOMMatrix(getComputedStyle(element).transform);
    const sample = () => {
      const width = drawer.getBoundingClientRect().width;
      const topMatrix = matrix(top);
      const bottomMatrix = matrix(bottom);
      const center = new DOMPoint(16, 12);
      const topCenter = center.matrixTransform(topMatrix);
      const bottomCenter = center.matrixTransform(bottomMatrix);
      // Compare visible progress, independent of the animation library or its clock.
      return [
        1 - matrix(drawer).e / width,
        -matrix(main).e / width,
        Number(getComputedStyle(overlay).opacity) / 0.16,
        Math.atan2(topMatrix.b, topMatrix.a) / (Math.PI / 4),
        1 - matrix(middle).a,
        -Math.atan2(bottomMatrix.b, bottomMatrix.a) / (Math.PI / 4),
        // The stroke centers must meet at the icon center along with the rotations.
        1 - (12 - topCenter.y) / 8,
        1 - (bottomCenter.y - 12) / 8,
      ];
    };
    const record = (reverse: boolean) => new Promise<{ frames: number[][]; reversed: boolean }>((resolve) => {
      const frames = [sample()];
      let reversed = false;
      const start = performance.now();
      toggle.click();
      const frame = () => {
        const values = sample();
        frames.push(values);
        if (reverse && !reversed && values[0] > 0.25 && values[0] < 0.9) {
          toggle.click();
          reversed = true;
        }
        if (performance.now() - start >= 700) resolve({ frames, reversed });
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    return [await record(false), await record(false), await record(true)];
  });

  for (const [index, recording] of recordings.entries()) {
    expect(recording.frames.some(([progress]) => progress > 0.1 && progress < 0.9)).toBe(true);
    for (const values of recording.frames) {
      expect(Math.max(...values) - Math.min(...values)).toBeLessThan(0.015);
    }
    for (const value of recording.frames.at(-1)!) {
      expect(value).toBeCloseTo(index === 0 ? 1 : 0, 2);
    }
  }
  expect(recordings[2].reversed).toBe(true);
  await expect(page.getByRole("button", { name: "Open location navigation" })).toBeEnabled();
  await expectPageInteractionState(page, false);
});

test("an unknown route has branded recovery and a working skip link", async ({
  page,
}) => {
  const response = await page.goto("missing-page/");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  await expect(page).toHaveTitle("Page not found | LAAW Life");
  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "That page isn't available. Choose a LAAW Life location to keep browsing.",
    ),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(
    page.getByRole("link", { name: "View Ivy Station calendar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View Hawthorne calendar" }),
  ).toBeVisible();

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await page.getByRole("link", { name: "View Ivy Station calendar" }).click();
  await expect(page).toHaveURL(/\/ivy\/$/);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the root page remains a usable location chooser", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./");

    const main = page.getByRole("main");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Choose a location");
    await expect(
      main.getByRole("heading", { level: 1, name: "Choose a location" }),
    ).toBeVisible();
    await expect(main.getByRole("link", { name: "Ivy Station" })).toBeVisible();
    const hawthorneLink = main.getByRole("link", { name: "Hawthorne" });
    await expect(hawthorneLink).toBeVisible();

    await hawthorneLink.click();
    await expect(page).toHaveURL(/\/hawthorne\/$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Hawthorne" }),
    ).toBeVisible();
  });
});
