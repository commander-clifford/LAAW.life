import { mkdir, readFileSync, writeFile } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import type { CalendarAgenda } from "../src/application/ports";

const agendas = JSON.parse(readFileSync(new URL("../.calendar-data/agendas.json", import.meta.url), "utf8")) as Record<string, CalendarAgenda>;
const source = agendas["ivy-station"];
const now = Math.max(Date.parse(`${source.initialDateKey}T19:00:00Z`), Date.parse(source.generatedAt) + 2000);
const auditDirectory = process.env.A11Y_REPORT_DIR;
async function audit(page: Page, info: TestInfo, step: string) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
  const summary = {
    test: info.title, step, url: page.url(), engine: result.testEngine, timestamp: result.timestamp,
    violations: result.violations, incomplete: result.incomplete,
    passes: result.passes.map(({ id }) => id),
  };
  await info.attach(step, { body: JSON.stringify(summary, null, 2), contentType: "application/json" });
  if (auditDirectory) {
    await promisify(mkdir)(auditDirectory, { recursive: true });
    await promisify(writeFile)(join(auditDirectory, `${info.title.replace(/[^a-zA-Z0-9-]+/g, "-")}-${step}.json`), JSON.stringify(summary, null, 2));
  }
  expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })), `${step}: WCAG A/AA and best-practice axe findings`).toEqual([]);
}

for (const width of [320, 1280]) {
  for (const appearance of ["light", "dark"] as const) {
    for (const mode of ["default", "combined"] as const) {
      test(`accessibility at ${width}px ${appearance} ${mode}`, async ({ page }, info) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: appearance, reducedMotion: width === 320 ? "reduce" : "no-preference" });
        await page.clock.setFixedTime(new Date(now));
        const query = mode === "combined" ? "?eventLayout=title-first" : "";
        await page.goto(`ivy/${query}`);
        await expect(page.locator(".day-carousel")).toHaveAttribute("aria-busy", "false");
        await audit(page, info, "today");
        await page.getByRole("button", { name: "Go to load more days", exact: true }).click();
        const more = page.locator(".day-card-more");
        await expect.poll(async () => more.evaluate(element => {
          const a = element.getBoundingClientRect(), b = element.closest(".day-carousel-viewport")!.getBoundingClientRect();
          return Math.abs(a.x - b.x);
        })).toBeLessThanOrEqual(1);
        await audit(page, info, "load-more");
        await more.click();
        await expect(page.locator("[data-day-card]")).toHaveCount(14);
        await expect(page.locator(".day-carousel-viewport")).toBeFocused();
        await page.getByRole("button", { name: /^Return to Today/ }).click();
        await expect(page.locator(".location-today-control")).toHaveCSS("opacity", "0");
        await page.getByRole("searchbox", { name: "Search events" }).fill("trivia");
        await expect(page.getByText(/\d+ matching events\./)).toBeVisible();
        await audit(page, info, "search-results");
        await page.getByRole("button", { name: "Clear search" }).click();
        await page.getByRole("searchbox", { name: "Search events" }).fill("no-matching-review-example");
        await audit(page, info, "empty-search");
        await page.getByRole("button", { name: "Clear search" }).click();
        await page.route("https://calendar.google.com/**", () => new Promise(() => undefined));
        await page.getByRole("button", { name: "Open full calendar", exact: true }).click();
        await audit(page, info, "calendar-loading");
        await page.locator(".calendar-shell iframe").evaluate(element => element.dispatchEvent(new Event("error")));
        await audit(page, info, "calendar-recovery");
        await page.getByRole("button", { name: "Open location navigation", exact: true }).click();
        await audit(page, info, "location-navigation");
        await page.keyboard.press("Escape");
        await page.goto(`hawthorne/${query}`);
        await expect(page.locator(".day-carousel")).toHaveAttribute("aria-busy", "false");
        await audit(page, info, "hawthorne");
      });
    }
  }
}
