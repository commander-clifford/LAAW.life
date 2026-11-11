import { expect, test, type Locator } from "@playwright/test";

for (const appearance of ["light", "dark"] as const) {
  test(`site-owned keyboard focus uses the shared orange in ${appearance}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.emulateMedia({ colorScheme: appearance, reducedMotion: "reduce" });
    await page.route("https://calendar.google.com/**", route => route.fulfill({ body: "<p>Calendar</p>", contentType: "text/html" }));
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("ivy/");
    expect((await page.request.get("favicon.ico")).status()).toBe(200);
    await expect(page.locator(".day-carousel")).toHaveAttribute("aria-busy", "false");
    await page.keyboard.press("Tab");
    const focus = async (target: Locator, marker = false) => {
      await target.focus();
      expect(await target.evaluate(element => element.matches(":focus-visible"))).toBe(true);
      const colors = await target.evaluate((element, useMarker) => {
        const s = getComputedStyle(useMarker ? element.querySelector("span")! : element);
        return `${s.outlineColor} ${s.boxShadow}`;
      }, marker);
      expect(colors).toContain("rgb(237, 85, 55)");
    };
    const input = page.getByRole("searchbox", { name: "Search events", exact: true });
    await focus(input);
    await expect(input).toHaveCSS("border-top-width", "0px");
    await input.fill("trivia");
    await focus(page.getByRole("list", { name: "Matching calendar events", exact: true }));
    await focus(page.getByRole("button", { name: "Clear search", exact: true }));
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    await page.keyboard.press("Tab");
    await focus(page.getByRole("button", { name: "Go to Tomorrow", exact: true }), true);
    await focus(page.getByRole("button", { name: "Next day", exact: true }));
    const open = page.getByRole("button", { name: "Open OG Calendar", exact: true });
    await focus(open);
    const inputFill = await page.locator("[data-day-card][data-active=true]").evaluate(element => getComputedStyle(element).backgroundColor);
    await expect(open).toHaveCSS("background-color", inputFill);
    await expect(open).toHaveCSS("border-radius", "24px");
    const buttonBox = (await open.boundingBox())!;
    const contentBox = (await page.locator(".calendar-disclosure").boundingBox())!;
    expect(buttonBox.width).toBeLessThan(contentBox.width);
    expect(buttonBox.x + buttonBox.width / 2).toBeCloseTo(contentBox.x + contentBox.width / 2, 0);
    await open.click();
    await expect(page.getByRole("button", { name: "Close OG Calendar", exact: true })).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "Close OG Calendar", exact: true }).click();
    await page.keyboard.press("Tab");
    const clifford = page.getByRole("link", { name: "Clifford", exact: true });
    await focus(clifford);
    await clifford.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Clifford links", exact: true });
    await focus(dialog.getByRole("button", { name: "Close dialog", exact: true }));
    await focus(dialog.getByRole("link", { name: "Instagram", exact: true }));
    await focus(dialog.getByRole("link", { name: "Buy me a brew", exact: true }));
    await page.keyboard.press("Escape");
    await focus(page.getByRole("link", { name: "LAAW.life", exact: true }));
    await page.getByRole("button", { name: "Open location navigation", exact: true }).press("Enter");
    await focus(page.getByRole("button", { name: "Close location navigation", exact: true }));
    await focus(page.getByRole("link", { name: "Hawthorne", exact: true }));
    await focus(page.getByRole("link", { name: "Old version", exact: true }));
    await focus(page.getByRole("combobox", { name: "Appearance", exact: true }));
    await focus(page.getByRole("combobox", { name: "Motion", exact: true }));
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--focus-color").trim())).toBe("#ed5537");
    expect(errors).toEqual([]);
  });
}
