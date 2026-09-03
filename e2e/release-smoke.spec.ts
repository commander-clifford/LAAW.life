import { expect, test, type Route } from "@playwright/test";

const googleCalendarPattern = "https://calendar.google.com/**";

async function fulfillCalendarFixture(route: Route): Promise<void> {
  await route.fulfill({
    body: "<!doctype html><title>Calendar fixture</title><p>Calendar fixture</p>",
    contentType: "text/html",
    status: 200,
  });
}

test.beforeEach(async ({ page }) => {
  await page.route(googleCalendarPattern, fulfillCalendarFixture);
});

test("a first-time visitor reaches Ivy and can switch locations", async ({ page }) => {
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
  await expect(page.getByRole("heading", { level: 1, name: "Ivy Station" })).toBeVisible();
  const calendarFrame = page.locator("iframe.calendar-frame");
  await expect(calendarFrame).toHaveCount(1);
  await expect(calendarFrame).toHaveAttribute("title", "Ivy Station Calendar");
  await expect(page.getByText("The calendar is taking longer than expected.")).toBeVisible({
    timeout: 12_000,
  });
  await expect(page.locator(".calendar-shell")).toHaveAttribute("aria-busy", "false");
  await expect(
    page.getByRole("link", { name: "Open the calendar in a new tab" }),
  ).toBeVisible();

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
  ).toBeVisible();
  await expect(reloadButton).toBeVisible();

  await page.unroute(googleCalendarPattern);
  const hawthorneCalendarRoutes: Route[] = [];
  await page.route(googleCalendarPattern, (route) => {
    hawthorneCalendarRoutes.push(route);
  });
  await page.getByRole("link", { name: "Hawthorne" }).click();

  await expect(page).toHaveURL(/\/hawthorne\/$/);
  await expect(page).toHaveTitle("Hawthorne Calendar | LAAW Life");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "View the Hawthorne calendar for LAAW Life.",
  );
  await expect(page.getByRole("heading", { level: 1, name: "Hawthorne" })).toBeVisible();
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

test("tablet navigation traps and restores keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("ivy/");

  const opener = page.getByRole("button", { name: "Open location navigation" });
  const calendar = page.locator("iframe.calendar-frame");

  await expect(opener).toBeVisible();
  await expect(opener).toBeEnabled();
  await expect(opener).toHaveAttribute("aria-haspopup", "dialog");
  await expect(calendar).toBeVisible();
  expect((await calendar.boundingBox())?.width).toBeGreaterThan(720);

  await opener.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Choose a location" });
  await expect(drawer).toHaveAttribute("aria-modal", "true");
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll("[data-page-interaction-surface]")].every(
          (element) => (element as HTMLElement).inert,
        ),
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "Close location navigation" }),
  ).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Close location navigation" }).first()).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("link", { name: "Hawthorne" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close location navigation" }).first()).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await expect(drawer).toBeHidden();
});

test("persistent navigation starts only when the calendar has enough room", async ({ page }) => {
  await page.setViewportSize({ width: 1023, height: 900 });
  await page.goto("ivy/");

  const opener = page.getByRole("button", { name: "Open location navigation" });
  await expect(opener).toBeVisible();
  await opener.click();
  const drawer = page.locator("#location-drawer");
  await expect(drawer).toHaveAttribute("role", "dialog");
  await expect(drawer).toHaveAttribute("aria-modal", "true");
  await expect(page.getByRole("button", { name: "Close location navigation" }).first()).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => [
        document.body.style.overflow,
        document.documentElement.style.overflow,
      ]),
    )
    .toEqual(["hidden", "hidden"]);

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(opener).toBeHidden();
  await expect(drawer).toHaveAttribute("aria-hidden", "false");
  await expect(drawer).toHaveAttribute("role", "complementary");
  await expect(drawer).not.toHaveAttribute("aria-modal", /.+/);
  await expect(page.getByRole("link", { name: /Ivy Station/ })).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => [
        document.body.style.overflow,
        document.documentElement.style.overflow,
      ]),
    )
    .toEqual(["", ""]);

  const calendar = page.locator("iframe.calendar-frame");
  expect((await calendar.boundingBox())?.width).toBeGreaterThan(700);

  const brand = page.getByRole("link", { name: "LAAW Life" });
  await brand.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /Ivy Station/ })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Hawthorne" })).toBeFocused();

  await page.setViewportSize({ width: 1023, height: 900 });
  await expect(opener).toBeVisible();
  await expect(opener).toBeFocused();
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
  await expect(drawer).toHaveAttribute("role", "dialog");
  await expect(drawer).toHaveAttribute("aria-modal", "true");
});

test("an unknown route has branded recovery and a working skip link", async ({
  page,
}) => {
  const response = await page.goto("missing-page/");

  expect(response?.status()).toBe(404);
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
