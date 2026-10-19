import { expect, test, type Page } from "@playwright/test";

async function expectBodyUsesPageToken(page: Page): Promise<void> {
  const colors = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--page)";
    document.body.append(probe);
    const result = {
      body: getComputedStyle(document.body).backgroundColor,
      pageToken: getComputedStyle(probe).backgroundColor,
    };
    probe.remove();
    return result;
  });

  expect(colors.body).toBe(colors.pageToken);
}

test("appearance follows the device and persists explicit choices without hydration errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("ivy/");
  const appearance = page.getByLabel("Appearance");
  await page.getByRole("button", { name: "Open location navigation" }).click();
  await expect(appearance).toHaveValue("system");
  await expectBodyUsesPageToken(page);
  await appearance.selectOption("light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  for (const selector of [".site-header", ".site-footer", ".day-card-heading"]) {
    await expect(page.locator(selector).first()).toHaveCSS("background-color", "rgb(227, 227, 227)");
  }
  await expect(page.locator("[data-day-card]").first()).toHaveCSS("background-color", "rgb(244, 244, 244)");
  await expect(page.getByRole("region", { name: "Search events", exact: true }).locator(".card.card-borderless")).toHaveCSS("background-color", "rgb(244, 244, 244)");
  await expect(page.getByRole("searchbox", { name: "Search events", exact: true })).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.reload();
  await page.getByRole("button", { name: "Open location navigation" }).click();
  await expect(appearance).toHaveValue("light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await appearance.selectOption("dark");
  await page.getByRole("navigation", { name: "Location calendars" }).getByRole("link", { name: "Hawthorne", exact: true }).click();
  await page.getByRole("button", { name: "Open location navigation" }).click();
  await expect(appearance).toHaveValue("dark");
  await expectBodyUsesPageToken(page);
  await appearance.selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  expect(errors).toEqual([]);
});

test("appearance still changes when local storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() { throw new DOMException("Storage is blocked", "SecurityError"); },
    });
  });
  await page.goto("ivy/");
  await page.getByRole("button", { name: "Open location navigation" }).click();
  await page.getByLabel("Appearance").selectOption("dark");
  await expectBodyUsesPageToken(page);
});

for (const location of ["ivy", "hawthorne"]) {
  test(`navigation remains ready after ordinary reloads at ${location}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${location}/`);

    for (let reload = 0; reload < 3; reload++) {
      const opener = page.getByRole("button", { name: "Open location navigation", exact: true });
      await expect(opener).toBeEnabled();
      await opener.click();
      await expect(page.getByRole("dialog", { name: "Location navigation", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(opener).toBeFocused();
      await page.reload();
    }

    await expect(page.getByRole("button", { name: "Open location navigation", exact: true })).toBeEnabled();
    expect(errors).toEqual([]);
  });
}

for (const [width, height] of [[320, 667], [1440, 1000]]) {
  test(`footer credit and the tip dialog work at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("ivy/");
    await page.getByRole("button", { name: "Open location navigation" }).click();
    await page.getByLabel("Appearance").selectOption("dark");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open location navigation" })).toBeFocused();
    await expect(page.locator(".day-carousel")).toHaveAttribute("aria-busy", "false");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(13, 13, 13)");
    const activeCard = page.locator("[data-day-card][data-active=true]");
    const cardHeading = activeCard.locator(".day-card-heading");
    await expect(activeCard).toHaveCSS("background-color", "rgb(56, 56, 56)");
    await expect(activeCard.locator(".day-card-weekday")).toHaveCSS("color", "rgb(227, 227, 227)");
    await expect(activeCard.locator(".day-card-calendar-date")).toHaveCSS("color", "rgb(176, 176, 176)");
    await expect(activeCard).toHaveCSS("border-radius", "24px");
    await expect(activeCard).toHaveCSS("box-shadow", "none");
    for (const edge of ["top", "right", "bottom", "left"]) {
      await expect(activeCard).toHaveCSS(`border-${edge}-width`, "0px");
    }
    await expect(cardHeading).toHaveCSS("background-color", "rgb(43, 43, 43)");
    await expect(page.locator(".site-header")).toHaveCSS("background-color", "rgb(43, 43, 43)");
    await expect(page.locator(".site-footer")).toHaveCSS("background-color", "rgb(43, 43, 43)");
    await expect(page.getByRole("region", { name: "Search events", exact: true }).locator(".card.card-borderless")).toHaveCSS("background-color", "rgb(56, 56, 56)");
    await expect(page.getByRole("searchbox", { name: "Search events", exact: true })).toHaveCSS("background-color", "rgb(77, 77, 77)");
    await expect(cardHeading).toHaveCSS("border-bottom-width", "0px");
    const pagination = page.getByRole("group", { name: "Choose a day", exact: true });
    await expect(pagination).toHaveCSS("background-color", "rgb(56, 56, 56)");
    await expect(pagination).toHaveCSS("border-radius", "24px");
    const currentIndicator = pagination.locator("button[aria-current=true] > span");
    const inactiveIndicators = pagination.locator("button:not([aria-current=true]) > span");
    await expect(currentIndicator).toHaveCount(1);
    await expect(currentIndicator).toHaveCSS("width", "24px");
    await expect(currentIndicator).toHaveCSS("height", "6px");
    await expect(currentIndicator).toHaveCSS("border-radius", "24px");
    expect(await inactiveIndicators.count()).toBeGreaterThan(0);
    for (const indicator of await inactiveIndicators.all()) {
      await expect(indicator).toHaveCSS("width", "6px");
      await expect(indicator).toHaveCSS("height", "6px");
      await expect(indicator).toHaveCSS("border-radius", "50%");
    }
    const paginationBounds = (await pagination.boundingBox())!;
    const cardBounds = (await activeCard.boundingBox())!;
    expect(paginationBounds.width).toBeLessThan(cardBounds.width);
    expect(paginationBounds.height).toBeLessThanOrEqual(48);
    const footer = page.getByRole("contentinfo");
    await expect(footer).toHaveText("Brewed by Clifford.");
    await expect(footer.getByRole("link", { name: "Clifford", exact: true })).toHaveAttribute("href", "https://www.instagram.com/ludocliff/");
    await expect(footer.getByRole("navigation")).toHaveCount(0);
    await expect(footer.getByRole("link")).toHaveCount(1);
    await expect(footer.getByLabel("Appearance")).toHaveCount(0);
    await expect(footer).not.toContainText("A little code.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`dark-page-${width}.png`), fullPage: true });
    const trigger = footer.getByRole("link", { name: "Clifford", exact: true });
    await trigger.click();
    const links = page.getByRole("dialog", { name: "Clifford links", exact: true });
    await expect(links).toBeVisible();
    await expect(links.getByRole("heading")).toHaveCount(0);
    await expect(links.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://www.instagram.com/ludocliff/");
    await expect(links.getByRole("button", { name: "Close dialog" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    const tipLink = links.getByRole("link", { name: "Buy me a brew" });
    await expect(tipLink).toBeFocused();
    await expect(tipLink).toHaveAttribute("href", "https://cash.app/$highestcliff");
    await page.keyboard.press("Tab");
    await expect(links.getByRole("button", { name: "Close dialog" })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`clifford-links-${width}.png`) });
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    await page.keyboard.press("Escape");
    await expect(links).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page.locator("body")).toHaveCSS("overflow-y", "visible");
  });
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false, colorScheme: "dark" });
  test("the device dark appearance and footer credit remain usable", async ({ page }) => {
    await page.goto("ivy/");
    await expectBodyUsesPageToken(page);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Clifford", exact: true })).toBeVisible();
  });
});
