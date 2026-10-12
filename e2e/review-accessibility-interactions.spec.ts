import { expect, test } from "@playwright/test";

const reviewComparison = process.env.PLAYWRIGHT_REVIEW_PREVIEW === "true";

for (const width of [320, 1280]) {
  test(`arrow browsing survives body, dots, arrow buttons, return and search focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("ivy/?eventLayout=title-first");
    await expect(page.locator(".event-row-prototype-controls")).toHaveCount(reviewComparison ? 1 : 0);
    const carousel = page.locator(".day-carousel");
    const viewport = page.locator(".day-carousel-viewport");
    await expect(carousel).toHaveAttribute("aria-busy", "false");
    await page.keyboard.press("ArrowRight");
    await expect(carousel).toHaveAttribute("data-active-index", "1");
    await expect(viewport).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(carousel).toHaveAttribute("data-active-index", "0");
    await carousel.getByRole("button", { name: "Go to Tomorrow", exact: true }).click();
    await page.keyboard.press("ArrowRight");
    await expect(carousel).toHaveAttribute("data-active-index", "2");
    if (width === 1280) {
      await carousel.getByRole("button", { name: "Next day", exact: true }).click();
      await expect(carousel).toHaveAttribute("data-active-index", "3");
      await page.keyboard.press("ArrowRight");
      await expect(carousel).toHaveAttribute("data-active-index", "4");
      await page.keyboard.press("ArrowLeft");
      await expect(carousel).toHaveAttribute("data-active-index", "3");
      for (let i = 0; i < 3; i++) await carousel.getByRole("button", { name: "Previous day", exact: true }).click();
      await expect(carousel).toHaveAttribute("data-active-index", "0");
      await page.keyboard.press("ArrowRight");
      await expect(carousel).toHaveAttribute("data-active-index", "1");
      await carousel.getByRole("button", { name: "Previous day", exact: true }).press("Enter");
      await expect(carousel).toHaveAttribute("data-active-index", "0");
      await expect(viewport).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect(carousel).toHaveAttribute("data-active-index", "1");
    }
    await page.getByRole("button", { name: /^Return to Today/ }).click();
    await expect(viewport).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(carousel).toHaveAttribute("data-active-index", "1");
    const input = page.getByRole("searchbox", { name: "Search events" });
    await input.fill("trivia");
    await input.press("ArrowLeft"); await input.press("ArrowRight");
    await expect(input).toBeFocused();
    await expect(carousel).toHaveAttribute("data-active-index", "1");
    const results = page.getByRole("list", { name: "Matching calendar events" });
    await results.focus();
    await page.keyboard.press("End");
    await expect.poll(() => results.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Clear search" }).click();
    if (reviewComparison) {
    await page.getByRole("button", { name: "Preview controls", exact: true }).click();
    await page.keyboard.press("ArrowRight");
    await expect(carousel).toHaveAttribute("data-active-index", "1");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Preview controls", exact: true })).toBeFocused();
    } else await expect(page.locator(".event-row-prototype-controls")).toHaveCount(0);
  });
}

for (const width of [320, 393, 1280]) {
  test(`card radius, spacing, neighbor peeks and detached controls remain coherent at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const boxes = async () => page.locator(".location-heading-section, [data-day-card][data-active='true'], section:has(input[type='search']), .calendar-disclosure").evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height };
    }));
    await page.goto("ivy/");
    await expect(page.locator(".day-carousel")).toHaveAttribute("aria-busy", "false");
    const ordinary = await boxes();
    await page.goto("ivy/?eventLayout=title-first");
    await expect(page.locator(".day-carousel")).toHaveAttribute("aria-busy", "false");
    expect(await boxes()).toEqual(ordinary);
    const radius = await page.locator("[data-day-card]").first().evaluate(element => getComputedStyle(element).borderTopLeftRadius);
    await expect(page.getByRole("searchbox", { name: "Search events" })).toHaveCSS("border-top-left-radius", radius);
    await page.getByRole("button", { name: "Go to Tomorrow", exact: true }).click();
    const metrics = await page.locator(".day-carousel-viewport").evaluate(element => {
      const view = element.getBoundingClientRect();
      const cards = [...element.querySelectorAll("[data-day-card]")].map(card => card.getBoundingClientRect());
      const visible = (box: DOMRect) => Math.max(0, Math.min(box.right, view.right) - Math.max(box.left, view.left));
      return { gap: cards[1].left - cards[0].right, previousPeek: visible(cards[0]), nextPeek: visible(cards[2]), centered: Math.abs(cards[1].x + cards[1].width / 2 - view.x - view.width / 2) };
    });
    expect(metrics.gap).toBeGreaterThanOrEqual(width < 704 ? 12 : 16);
    expect(metrics.previousPeek).toBeGreaterThanOrEqual(7);
    expect(metrics.nextPeek).toBeGreaterThanOrEqual(7);
    expect(metrics.centered).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (reviewComparison) {
    await page.getByRole("button", { name: "Preview controls", exact: true }).click();
    await page.getByRole("button", { name: "Proposed: title first", exact: true }).click();
    await page.getByRole("button", { name: "Go to Today", exact: true }).click();
    await expect(page.getByRole("button", { name: "Preview controls", exact: true })).toHaveAttribute("aria-expanded", "false");
    } else await expect(page.locator(".event-row-prototype-controls")).toHaveCount(0);
  });
}

test("the motion preference persists and follows the device without a proposed date float", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("ivy/?eventLayout=title-first");
  await page.getByRole("button", { name: "Open location navigation", exact: true }).click();
  await page.getByRole("combobox", { name: "Motion", exact: true }).selectOption("reduce");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Go to Tomorrow", exact: true }).click();
  await expect(page.locator(".day-carousel")).toHaveAttribute("data-active-index", "1");
  await expect(page.locator(".location-today-control")).toHaveAttribute("data-scroll-progress", /^1(?:\.0+)?$/);
  await expect(page.locator(".date-handoff-layer")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
  await page.getByRole("button", { name: "Open location navigation", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Motion", exact: true })).toHaveValue("reduce");
  await page.getByRole("combobox", { name: "Motion", exact: true }).selectOption("system");
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "system");
});
