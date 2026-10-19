import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const directory = process.env.REVIEW_SCREENSHOT_DIR;
const source = JSON.parse(readFileSync(new URL("../.calendar-data/agendas.json", import.meta.url), "utf8"))["ivy-station"];
const dates = [...new Set<string>([...source.availableDateKeys, ...source.events.flatMap((event: { dateKeys: string[] }) => event.dateKeys)])].sort();
const format = (date: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const coverage = `Search past and upcoming events from ${format(dates[0])} through ${format(dates.at(-1)!)}.`;

for (const width of [320, 1280]) for (const appearance of ["light", "dark"] as const) {
  test(`borderless search container and centered coverage stay readable at ${width}px ${appearance}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: appearance, reducedMotion: "reduce" });
    await page.goto("ivy/?eventLayout=title-first");
    await expect(page.locator(".day-carousel")).toHaveAttribute("aria-busy", "false");
    const input = page.getByRole("searchbox", { name: "Search events", exact: true });
    const section = page.getByRole("region", { name: "Search events", exact: true });
    const note = section.getByText(coverage, { exact: true });
    const container = section.locator(".card.card-borderless");
    await expect(input).toBeVisible();
    await expect(input).toHaveAccessibleName("Search events");
    await expect(input).toHaveAttribute("placeholder", "Search events");
    await expect(input).toHaveAccessibleDescription(coverage);
    await expect(note).toBeVisible();
    await expect(note).toHaveCSS("text-align", "center");
    await expect(note).toHaveCSS("font-size", "12px");
    await expect(note).toHaveCSS("opacity", "1");
    await expect(section.getByRole("heading")).toHaveCount(0);
    await expect(section).toHaveCSS("border-top-width", "0px");
    await expect(container).toHaveCSS("border-top-width", "0px");
    await expect(container).toHaveCSS("box-shadow", "none");
    const surface = await container.evaluate(element => ({ background: getComputedStyle(element).backgroundColor, page: getComputedStyle(document.body).backgroundColor }));
    expect(surface.background).not.toBe(surface.page);
    expect(surface.background).not.toBe("rgba(0, 0, 0, 0)");
    await expect(page.getByRole("button", { name: "About search coverage", exact: true })).toHaveCount(0);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    const card = (await page.locator("[data-day-card]").first().boundingBox())!;
    const cardRadius = await page.locator("[data-day-card]").first().evaluate(element => getComputedStyle(element).borderTopLeftRadius);
    await expect(input).toHaveCSS("border-top-color", appearance === "light" ? "rgb(96, 112, 134)" : "rgb(146, 146, 146)");
    await expect(input).toHaveCSS("border-top-width", "1px");
    await expect(input).toHaveCSS("border-top-style", "solid");
    await expect(input).toHaveCSS("border-top-left-radius", cardRadius);
    const field = (await input.boundingBox())!;
    const support = (await note.boundingBox())!;
    for (const box of [(await container.boundingBox())!, (await section.boundingBox())!]) {
      expect(Math.abs(card.x - box.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(card.width - box.width)).toBeLessThanOrEqual(1);
    }
    const wrapper = (await container.boundingBox())!;
    const padding = await container.evaluate(element => ({ left: parseFloat(getComputedStyle(element).paddingLeft), right: parseFloat(getComputedStyle(element).paddingRight) }));
    const dayPadding = await page.locator("[data-day-card]").first().evaluate(element => ({ left: parseFloat(getComputedStyle(element).paddingLeft), right: parseFloat(getComputedStyle(element).paddingRight), radius: getComputedStyle(element).borderTopLeftRadius }));
    expect(padding).toEqual({ left: dayPadding.left, right: dayPadding.right });
    await expect(container).toHaveCSS("border-top-left-radius", dayPadding.radius);
    expect(Math.abs(field.x - wrapper.x - padding.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(field.width - wrapper.width + padding.left + padding.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(support.x + support.width / 2 - field.x - field.width / 2)).toBeLessThanOrEqual(1);
    expect(support.width).toBeLessThanOrEqual(field.width + 1);
    expect(support.y).toBeGreaterThan(field.y + field.height);
    const contrast = await note.evaluate(element => {
      const channels = (color: string) => {
        const values = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        return color.startsWith("color(srgb") ? values : values.map(value => value / 255);
      };
      const luminance = (rgb: number[]) => rgb.map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      const foreground = luminance(channels(getComputedStyle(element).color));
      const background = luminance(channels(getComputedStyle(element.closest(".card")!).backgroundColor));
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    const reports = [];
    const scan = async (state: string) => {
      const report = await new AxeBuilder({ page }).include("section:has(input[type=search])").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
      reports.push({ state, contrast, violations: report.violations, incomplete: report.incomplete });
      expect(report.violations.map(item => item.id)).toEqual([]);
    };
    await scan("supporting-text");
    if (directory) await page.screenshot({ path: join(directory, `search-container-${appearance}-${width}.png`) });
    await input.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Open full calendar", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(input).toBeFocused();
    await expect(input).not.toHaveCSS("box-shadow", "none");
    await input.fill("trivia");
    await expect(page.getByText(/\d+ matching events\./)).toBeVisible();
    const index = await page.locator(".day-carousel").getAttribute("data-active-index");
    await input.press("ArrowLeft"); await input.press("ArrowRight");
    await expect(input).toBeFocused();
    await expect(page.locator(".day-carousel")).toHaveAttribute("data-active-index", index!);
    await scan("results");
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect(note).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (directory) await writeFile(join(directory, `search-container-checks-${appearance}-${width}.json`), JSON.stringify(reports, null, 2));
  });
}

test.describe("touch search", () => {
  test.use({ hasTouch: true });
  test("a phone search keeps coverage visible when results are cleared", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto("ivy/");
    const input = page.getByRole("searchbox", { name: "Search events" });
    const note = page.getByText(coverage, { exact: true });
    await input.tap(); await input.fill("trivia");
    await expect(page.getByText(/\d+ matching events\./)).toBeVisible();
    await expect(note).toBeVisible();
    await page.getByRole("button", { name: "Clear search", exact: true }).tap();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect(note).toBeVisible();
  });
});
