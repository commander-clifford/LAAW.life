import { describe, expect, it } from "vitest";
import { getFeaturedDayEvent } from "./featured-day-event";
import type { CalendarAgendaItem } from "./ports";

const date = "2026-10-02";
function event(id: string, priority: number, theme: "trivia" | "bingo" = "trivia"): CalendarAgendaItem {
  return { id, title: id, start: `${date}T19:00:00.000Z`, end: `${date}T20:00:00.000Z`, allDay: false,
    dateKeys: [date], location: null, sourceName: "Test", metadata: { tags: [theme], takeover: { enabled: true, theme, priority } } };
}
describe("featured day event", () => {
  it("selects the highest eligible rank while retaining the complete input schedule", () => {
    const events = [event("Bingo", 80, "bingo"), event("Trivia", 100)];
    expect(getFeaturedDayEvent(events, date)?.title).toBe("Trivia");
    expect(events.map(item => item.title)).toEqual(["Bingo", "Trivia"]);
  });
  it("ignores disabled, unconfigured and other-day events", () => {
    const disabled = { ...event("Disabled", 999), metadata: { tags: [], takeover: { enabled: false, theme: "trivia" as const, priority: 999 } } };
    const tomorrow = { ...event("Future", 999), dateKeys: ["2026-10-03"] };
    const unconfigured = { ...event("Trivia title without an enabled rule", 999), metadata: undefined };
    expect(getFeaturedDayEvent([disabled, tomorrow, unconfigured], date)).toBeNull();
  });
  it("breaks equal ranks by start time and then stable identity, independent of source order", () => {
    const early = { ...event("early", 100), start: `${date}T18:00:00.000Z` };
    expect(getFeaturedDayEvent([event("a", 100), early], date)?.id).toBe("early");
    expect(getFeaturedDayEvent([event("z", 100), event("a", 100)], date)?.id).toBe("a");
    expect(getFeaturedDayEvent([event("a", 100), event("z", 100)], date)?.id).toBe("a");
  });
  it("themes an eligible multi-day occurrence on each covered date only", () => {
    const spanning = { ...event("weekend", 50), dateKeys: [date, "2026-10-03"] };
    expect(getFeaturedDayEvent([spanning], "2026-10-03")?.id).toBe("weekend");
    expect(getFeaturedDayEvent([spanning], "2026-10-04")).toBeNull();
  });
});
