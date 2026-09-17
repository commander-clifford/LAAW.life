import { expect, test } from "@playwright/test";

test("appearance follows the device and persists explicit choices without hydration errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("ivy/");
  const appearance = page.getByLabel("Appearance");
  await expect(appearance).toHaveValue("system");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(37, 40, 41)");
  await appearance.selectOption("light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.reload();
  await expect(appearance).toHaveValue("light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await appearance.selectOption("dark");
  await page.getByRole("contentinfo").getByRole("link", { name: "Hawthorne", exact: true }).click();
  await expect(appearance).toHaveValue("dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(37, 40, 41)");
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
  await page.getByLabel("Appearance").selectOption("dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(37, 40, 41)");
});

for (const [width, height] of [[320, 667], [1440, 1000]]) {
  test(`footer links and the tip dialog work at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto("ivy/");
    await page.getByLabel("Appearance").selectOption("dark");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Clifford", exact: true })).toHaveAttribute("href", "https://github.com/commander-clifford");
    await expect(footer.getByRole("link", { name: "Ivy Station", exact: true })).toHaveAttribute("href", /\/ivy\/?$/);
    await expect(footer.getByRole("link", { name: "OG Regular", exact: true })).toHaveAttribute("href", /\/og\/$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`dark-page-${width}.png`), fullPage: true });
    const trigger = footer.getByRole("button", { name: "Buy Clifford a beer" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Buy Clifford a beer" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close tip jar" })).toBeFocused();
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    await dialog.getByRole("button", { name: "$7", exact: true }).click();
    await expect(dialog.getByLabel("Custom amount (USD)")).toHaveValue("7");
    await dialog.getByLabel("Custom amount (USD)").fill("2");
    await expect(dialog.getByLabel("Custom amount (USD)")).toHaveValue("2");
    await expect(dialog.locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(dialog).toContainText("Payments aren’t connected yet.");
    await expect(dialog.getByRole("button", { name: "Tip jar coming soon" })).toBeDisabled();
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.width).toBeLessThanOrEqual(width - 32);
    expect(bounds.height).toBeLessThanOrEqual(height - 32);
    await page.screenshot({ path: testInfo.outputPath(`tip-dialog-${width}.png`) });
    await dialog.getByRole("button", { name: "Close tip jar" }).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByLabel("Custom amount (USD)")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page.locator("body")).toHaveCSS("overflow-y", "visible");
  });
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false, colorScheme: "dark" });
  test("the device dark appearance and footer links remain usable", async ({ page }) => {
    await page.goto("ivy/");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(37, 40, 41)");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "OG Regular" })).toBeVisible();
  });
});
