import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { addDaysToDateKey } from "../src/application/calendar-dates";
import type { CalendarAgenda, CalendarAgendaItem } from "../src/application/ports";
const agendas = JSON.parse(readFileSync(new URL("../.calendar-data/agendas.json", import.meta.url), "utf8")) as Record<string, CalendarAgenda>;
const agenda = agendas["ivy-station"];
const today = agenda.initialDateKey;
const now = Math.max(Date.parse(`${today}T19:00:00.000Z`), Date.parse(agenda.generatedAt) + 2000);
function event(id: string, title: string, theme?: "trivia" | "bingo", priority = 100, date = today): CalendarAgendaItem {
  return { id, title, allDay: false, dateKeys: [date], start: `${date}T19:00:00.000Z`, end: `${date}T20:00:00.000Z`, location: null, sourceName: "Deterministic theme test",
    ...(theme ? { metadata: { tags: [theme], takeover: { enabled: true, theme, priority } } } : {}) };
}
for (const scenario of [
  { width: 320, appearance: "light", theme: "trivia" },
  { width: 320, appearance: "dark", theme: "bingo" },
  { width: 1280, appearance: "light", theme: "bingo" },
  { width: 1280, appearance: "dark", theme: "trivia" },
] as const) {
  test(`Today preserves dates and busy schedules with ${scenario.theme} at ${scenario.width}px ${scenario.appearance}`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: 900 });
    await page.emulateMedia({ colorScheme: scenario.appearance, reducedMotion: "reduce" });
    await page.clock.setFixedTime(new Date(now));
    const events = [event("featured", scenario.theme === "trivia" ? "Lucky Guess Trivia" : "Thrift Store Bingo", scenario.theme),
      ...Array.from({ length: 7 }, (_, i) => event(`other-${i}`, `Neighborhood food truck and community event ${i + 1}`)),
      event("future", "Future recognized event", scenario.theme, 999, addDaysToDateKey(today, 1))];
    const fixture = { ...agenda, events, generatedAt: new Date(now - 1000).toISOString() };
    await page.route("**/calendar-data/agendas.json", route => route.fulfill({ json: { ...agendas, "ivy-station": fixture } }));
    await page.goto("ivy/");
    const cards = page.locator("[data-day-card]");
    const first = cards.first();
    await expect(first).toHaveAttribute("data-event-theme", scenario.theme);
    await expect(first.locator(".day-card-date time")).toHaveAttribute("datetime", today);
    await expect(first.locator(".day-card-relative-label")).toHaveText("Today");
    await expect(first.locator(".day-card-event")).toHaveCount(8);
    await expect(first.locator("[data-featured='true']")).toHaveCount(1);
    await expect(first).toHaveAccessibleDescription(`Today's featured event: ${events[0].title}.`);
    await expect(cards.nth(1)).not.toHaveAttribute("data-event-theme");
    await expect(first.locator(".day-card-schedule")).toHaveAttribute("data-overflow", "true");
    const heights = await cards.evaluateAll(elements => elements.map(el => (el as HTMLElement).offsetHeight));
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    const contrast = await first.evaluate(card => {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      const luminance = (color: string) => {
        context.fillStyle = color; context.fillRect(0, 0, 1, 1);
        const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      const ratio = (text: string, background: string) => { const a = luminance(text), b = luminance(background); return (Math.max(a,b) + .05) / (Math.min(a,b) + .05); };
      const heading = card.querySelector(".day-card-heading")!;
      const title = card.querySelector("[data-featured='true'] h3")!;
      return { date: Math.min(...[...heading.querySelectorAll(".day-card-weekday, .day-card-calendar-date, .day-card-relative-label")].map(el => ratio(getComputedStyle(el).color, getComputedStyle(heading).backgroundColor))), title: ratio(getComputedStyle(title).color, getComputedStyle(card).backgroundColor) };
    });
    expect(contrast.date).toBeGreaterThanOrEqual(4.5);
    expect(contrast.title).toBeGreaterThanOrEqual(4.5);
    await first.locator(".day-card-schedule").evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(first.locator(".day-card-schedule-frame")).toHaveAttribute("data-at-end", "true");
    await page.getByRole("button", { name: "Go to Tomorrow", exact: true }).click();
    await expect(page.locator(".day-carousel")).toHaveAttribute("data-active-index", "1");
    await page.getByRole("button", { name: /^Return to Today/ }).click();
    await expect(page.locator(".day-carousel")).toHaveAttribute("data-active-index", "0");
  });
}

test("metadata refresh changes a competing Today theme without dropping daily events", async ({ page }) => {
  await page.clock.setFixedTime(new Date(now));
  let preferBingo = false;
  await page.route("**/calendar-data/agendas.json", route => route.fulfill({ json: { ...agendas, "ivy-station": {
    ...agenda, generatedAt: new Date(now - (preferBingo ? 500 : 1000)).toISOString(),
    events: [event("trivia", "Lucky Guess Trivia", "trivia", preferBingo ? 50 : 100), event("bingo", "Thrift Store Bingo", "bingo", 80), event("other", "Food truck")],
  } } }));
  await page.goto("ivy/");
  const first = page.locator("[data-day-card]").first();
  await expect(first).toHaveAttribute("data-event-theme", "trivia");
  preferBingo = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(first).toHaveAttribute("data-event-theme", "bingo");
  await expect(first.locator(".day-card-event")).toHaveCount(3);
  await expect(first.locator("[data-featured='true'] h3")).toHaveText("Thrift Store Bingo");
});
