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
  await expect(drawer).not.toHaveAttribute("aria-modal", "true");
  await expectPageInteractionState(page, false);
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
  expect(Math.abs(cardBox.x + cardBox.width / 2 - layoutWidth / 2)).toBeLessThan(1);
  expect(Math.abs(calendarBox.x - contentBox.x)).toBeLessThan(1);
  expect(Math.abs(calendarBox.width - contentBox.width)).toBeLessThan(1);
  expect(calendarBox.width).toBeGreaterThan(layoutWidth - 40);
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

test("the fine-print footer opens the unchanged original site", async ({ page }) => {
  await page.goto("ivy/");
  const originalLink = page.getByRole("contentinfo").getByRole("link", { name: "OG — original LAAW.life site" });
  await expect(originalLink).toHaveText("OG");
  await expect(page.getByRole("navigation").getByText("OG", { exact: true })).toHaveCount(0);
  await originalLink.click();
  await expect(page).toHaveURL(/\/og\/$/);
  await expect(page.locator("iframe")).toHaveCount(2);
  await expect(page.locator(".site-header, .site-footer, script[src*='_next']")).toHaveCount(0);
  const response = await page.request.get(page.url());
  expect(await response.text()).toBe(readFileSync(new URL("../public/og/index.html", import.meta.url), "utf8"));
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
  await page.getByRole("link", { name: "Hawthorne" }).click();

  await expect(page).toHaveURL(/\/hawthorne\/$/);
  await expect(page).toHaveTitle("Hawthorne Calendar | LAAW Life");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "View the Hawthorne calendar for LAAW Life.",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hawthorne");
  await expect(page.locator(".site-header")).not.toContainText("Hawthorne");
  await expect(page.getByText("Loading calendar…")).toBeVisible();
  await expect(page.locator("iframe.calendar-frame")).toHaveClass(
    /calendar-frame-concealed/,
  );
  await expect.poll(() => hawthorneCalendarRoutes.length).toBe(1);
  await fulfillCalendarFixture(hawthorneCalendarRoutes[0]);
  await expect(page.locator(".calendar-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator("iframe.calendar-frame")).not.toHaveClass(
    /calendar-frame-concealed/,
  );
  await expect(page.getByRole("main")).toBeFocused();
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

  // A direct location URL also updates the next visit to the root chooser.
  await page.goto("hawthorne/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hawthorne");
  await expect.poll(() => page.evaluate(() =>
    window.localStorage.getItem("laaw-life:laaw-life:last-location:v1"),
  )).toBe("hawthorne");
  await page.goto("./");
  await expect(page).toHaveURL(/\/hawthorne\/$/);
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
  test(`${device} navigation traps focus, dismisses, and restores the correct target`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("ivy/");

    const opener = page.getByRole("button", { name: "Open location navigation" });
    const drawer = page.locator("#location-drawer");
    const close = drawer.getByRole("button", { name: "Close location navigation" });
    const current = drawer.getByRole("link", { name: /Ivy Station/ });
    const hawthorne = drawer.getByRole("link", { name: "Hawthorne" });
    await expect(opener).toBeVisible();
    await expect(opener).toBeEnabled();
    await expect(opener).toHaveAttribute("aria-haspopup", "dialog");
    await expect(drawer).toHaveAttribute("aria-hidden", "true");

    await opener.focus();
    await page.keyboard.press("Enter");
    await expect(drawer).toHaveAttribute("role", "dialog");
    await expect(drawer).toHaveAttribute("aria-modal", "true");
    await expect(drawer.getByRole("heading")).toHaveCount(0);
    await expect(current).toHaveAttribute("aria-current", "page");
    await expect(close).toBeFocused();
    await expectPageInteractionState(page, true);

    await page.keyboard.press("Shift+Tab");
    await expect(hawthorne).toBeFocused();
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
    await page.keyboard.press("Shift+Tab");
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
  const hawthorne = drawer.getByRole("link", { name: "Hawthorne" });
  await expectClosedNavigationLayout(page, 1023);
  await opener.click();
  await expect(drawer.getByRole("button", { name: "Close location navigation" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");

  for (const width of [1024, 1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
    await expect(drawer).toHaveAttribute("role", "dialog");
    await expect(drawer).toHaveAttribute("aria-modal", "true");
    await expect(drawer).toHaveJSProperty("inert", false);
    await expect(drawer).toBeInViewport();
    await expect(drawer.locator(".location-drawer-header")).toBeVisible();
    await expect(hawthorne).toBeFocused();
    await expect(page.locator(".navigation-toggle")).toBeDisabled();
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
