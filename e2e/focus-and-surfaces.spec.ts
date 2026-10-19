import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const reviewComparison = process.env.PLAYWRIGHT_REVIEW_PREVIEW === "true";

const artifactDirectory = process.env.REVIEW_SCREENSHOT_DIR;
const agendas = JSON.parse(readFileSync(new URL("../.calendar-data/agendas.json", import.meta.url), "utf8"));
for (const width of [393, 1280]) for (const appearance of ["light", "dark"] as const) {
  test(`hover, focus and color placement remain readable at ${width}px ${appearance}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: appearance, reducedMotion: "reduce" });
    const source = agendas["ivy-station"];
    const now = Math.max(Date.parse(`${source.initialDateKey}T19:00:00Z`), Date.parse(source.generatedAt) + 2000);
    await page.clock.setFixedTime(new Date(now));
    await page.route("**/calendar-data/agendas.json", route => route.fulfill({ json: { ...agendas, "ivy-station": {
      ...source, generatedAt: new Date(now - 1000).toISOString(), events: [{
        id: "focus-review-fixture", title: "Community meetup", allDay: false,
        start: `${source.initialDateKey}T19:00:00.000Z`, end: `${source.initialDateKey}T20:00:00.000Z`,
        dateKeys: [source.initialDateKey], location: null, sourceName: "Test fixture",
      }, ...source.events],
    } } }));
    await page.goto("ivy/?eventLayout=title-first");
    await expect(page.locator(".event-row-prototype-controls")).toHaveCount(reviewComparison ? 1 : 0);
    const carousel = page.locator(".day-carousel");
    await expect(carousel).toHaveAttribute("aria-busy", "false");
    const colors = await page.evaluate(() => {
      const parse = (value: string) => {
        const channels = value.match(/[\d.]+/g)!.map(Number);
        return value.startsWith("color(") ? channels.slice(0, 3).map(n => n * 255) : channels.slice(0, 3);
      };
      const blend = (a: number[], b: number[], opacity: number) => a.map((value, i) => value * opacity + b[i] * (1 - opacity));
      const luminance = (rgb: number[]) => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
      const ratio = (a: number[], b: number[]) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
      const body = parse(getComputedStyle(document.body).backgroundColor);
      const text = [...document.querySelectorAll("[data-day-card] .day-card-calendar-date, [data-day-card] .day-card-event-time, [data-day-card] h3")].map(element => {
        const card = element.closest("[data-day-card]")!;
        const opacity = Number(getComputedStyle(card).opacity);
        const background = element.closest(".day-card-heading") ?? card;
        const rgb = parse(getComputedStyle(element).color);
        const surface = parse(getComputedStyle(background).backgroundColor);
        return { label: element.textContent, active: card.getAttribute("data-active"), ratio: ratio(blend(rgb, body, opacity), blend(surface, body, opacity)) };
      });
      const input = document.querySelector("input[type=search]")!;
      const placeholder = getComputedStyle(input, "::placeholder").color;
      const focus = getComputedStyle(document.documentElement).getPropertyValue("--focus").trim();
      return { page: getComputedStyle(document.body).backgroundColor, card: getComputedStyle(document.querySelector("[data-day-card]")!).backgroundColor, text, placeholderRatio: ratio(parse(placeholder), parse(getComputedStyle(input).backgroundColor)), focusToken: focus };
    });
    for (const item of colors.text) expect(item.ratio, item.label ?? "date/time/title").toBeGreaterThanOrEqual(4.5);
    expect(colors.placeholderRatio).toBeGreaterThanOrEqual(4.5);
    if (appearance === "light") expect(colors.page).not.toEqual(colors.card);
    const card = page.locator("[data-day-card]").first();
    const background = await card.evaluate(element => getComputedStyle(element).backgroundColor);
    await card.locator(".day-card-heading").hover();
    await expect(card).toHaveCSS("background-color", background);
    await card.locator("h3").first().hover();
    await expect(card).toHaveCSS("background-color", background);
    await page.keyboard.press("Tab");
    const viewport = page.locator(".day-carousel-viewport");
    await viewport.focus();
    expect(await card.evaluate(element => getComputedStyle(element, "::after").content)).not.toBe("none");
    const capture = async (step: string) => {
      if (artifactDirectory) await page.screenshot({ path: join(artifactDirectory, `focus-${step}-${appearance}-${width}.png`), fullPage: false });
    };
    await capture("card");
    await carousel.getByRole("button", { name: "Go to In 6 days", exact: true }).click();
    await page.keyboard.press("ArrowRight");
    const loader = page.getByRole("button", { name: "Load seven more days", exact: true });
    await expect(loader).toBeFocused();
    await expect(loader).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(loader).toHaveCSS("border-top-width", "0px");
    await expect.poll(() => loader.evaluate(element => {
      const box = element.getBoundingClientRect(); const rail = element.closest(".day-carousel-viewport")!.getBoundingClientRect();
      return Math.abs(box.x + box.width / 2 - rail.x - rail.width / 2);
    })).toBeLessThanOrEqual(1);
    await capture("load-more");
    await page.keyboard.press("Enter");
    await expect(carousel).toHaveAttribute("data-active-index", "7");
    await expect(page.locator("[data-day-card]")).toHaveCount(14);
    const search = page.getByRole("searchbox", { name: "Search events", exact: true });
    await search.fill("trivia");
    await expect(search).toBeFocused();
    expect(await search.evaluate(element => getComputedStyle(element).boxShadow)).not.toBe("none");
    await capture("search");
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    if (reviewComparison) {
    await page.getByRole("button", { name: "Preview controls", exact: true }).press("Enter");
    const preview = page.getByRole("button", { name: "Hide preview controls", exact: true });
    expect(await preview.evaluate(element => getComputedStyle(element).boxShadow)).not.toBe("none");
    await page.keyboard.press("Escape");
    } else await expect(page.locator(".event-row-prototype-controls")).toHaveCount(0);
    await page.getByRole("button", { name: "Open location navigation", exact: true }).press("Enter");
    const close = page.getByRole("button", { name: "Close location navigation", exact: true });
    await expect(close).toBeFocused();
    expect(await close.evaluate(element => getComputedStyle(element).boxShadow)).not.toBe("none");
    expect(await close.evaluate(element => Boolean(document.getElementById(element.getAttribute("aria-controls")!)))).toBe(true);
    await capture("menu");
    await page.keyboard.press("Escape");
    await expect(page.locator("#location-drawer")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("main")).toHaveJSProperty("inert", false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (artifactDirectory) {
      await mkdir(artifactDirectory, { recursive: true });
      await writeFile(join(artifactDirectory, `manual-colors-${appearance}-${width}.json`), JSON.stringify(colors, null, 2));
    }
  });
}
