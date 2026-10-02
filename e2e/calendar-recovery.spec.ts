import { expect, test } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`calendar recovery keeps its layout and frame at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install();
    await page.route("https://calendar.google.com/**", () => {});
    await page.goto("ivy/");
    const frame = page.locator("iframe.calendar-frame");
    await expect(frame).toHaveCount(0);
    const toggle = page.locator(".calendar-disclosure-toggle");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const shell = page.locator(".calendar-shell");
    await expect(shell).toHaveAttribute("data-calendar-status", "loading");
    await expect(page.locator(".calendar-status")).toContainText("Loading calendar…");
    const stableBox = async () => {
      const box = (await shell.boundingBox())!;
      return { ...box, y: box.y + await page.evaluate(() => window.scrollY) };
    };
    const initialBox = await stableBox();
    await page.clock.fastForward(10_000);
    await expect(shell).toHaveAttribute("data-calendar-status", "slow");
    await expect(page.locator(".calendar-status")).toContainText("taking longer");
    expect(await stableBox()).toEqual(initialBox);
    const originalFrame = await frame.elementHandle();
    await page.getByRole("button", { name: "Reload calendar" }).click();
    await expect(shell).toHaveAttribute("data-calendar-status", "loading");
    expect(await originalFrame!.evaluate((element) => element.isConnected)).toBe(false);
    await frame.dispatchEvent("error");
    await expect(shell).toHaveAttribute("data-calendar-status", "error");
    await expect(page.locator(".calendar-status")).toContainText("could not load");
    expect(await stableBox()).toEqual(initialBox);
    await expect(page.getByRole("link", { name: "Open in Google Calendar" })).toHaveAttribute("target", "_blank");
    await page.getByRole("button", { name: "Reload calendar" }).click();
    await frame.dispatchEvent("load");
    await expect(shell).toHaveAttribute("data-calendar-status", "ready");
    await expect(page.locator(".calendar-status")).toBeHidden();
    expect(await stableBox()).toEqual(initialBox);
    const loadedFrame = await frame.elementHandle();
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(frame).toBeHidden();
    await page.keyboard.press("Enter");
    await expect(frame).toBeVisible();
    expect(await loadedFrame!.evaluate((element) => element.isConnected)).toBe(true);
    await expect(shell).toHaveAttribute("data-calendar-status", "ready");
  });
}
