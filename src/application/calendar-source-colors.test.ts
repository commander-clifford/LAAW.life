import { describe, expect, it } from "vitest";

import { getNewerCalendarAgenda } from "@/src/application/calendar-agenda";
import { getDayCardDates } from "@/src/application/calendar-dates";
import { withCalendarSourceColors } from "@/src/application/calendar-source-colors";
import type { CalendarAgenda, CalendarAgendaItem } from "@/src/application/ports";

const venueId = "venue@example.com";
const sportsId = "sports@example.com";
const sourceColors = [
  { calendarId: venueId, color: "#7986CB" },
  { calendarId: sportsId, color: "#616161" },
];

function event(overrides: Partial<CalendarAgendaItem> = {}): CalendarAgendaItem {
  return {
    allDay: false,
    dateKeys: ["2026-10-12"],
    end: "2026-10-13T02:00:00.000Z",
    id: `${venueId}:food-truck:2026-10-13T01:00:00.000Z`,
    location: null,
    sourceName: "Venue calendar",
    start: "2026-10-13T01:00:00.000Z",
    title: "Food truck",
    ...overrides,
  };
}

function agenda(events: readonly CalendarAgendaItem[]): CalendarAgenda {
  return {
    availableDateKeys: getDayCardDates("2026-10-12").map(({ dateKey }) => dateKey),
    events,
    failedSourceCount: 0,
    generatedAt: "2026-10-12T16:00:00.000Z",
    initialDateKey: "2026-10-12",
    sourceCount: 2,
    timeZone: "America/Los_Angeles",
  };
}

describe("calendar source color enrichment", () => {
  it("uses exact source metadata independently of event names and IDs", () => {
    const original = agenda([
      event({ id: "food", sourceCalendarId: venueId }),
      event({ id: "game", sourceCalendarId: sportsId, sourceName: "Venue calendar" }),
    ]);
    const colored = withCalendarSourceColors(original, sourceColors);

    expect(colored.events.map(({ sourceColor }) => sourceColor)).toEqual(["#7986CB", "#616161"]);
    expect(original.events.every((item) => item.sourceColor === undefined)).toBe(true);
    expect(colored.generatedAt).toBe(original.generatedAt);
    expect(colored.sourceCount).toBe(original.sourceCount);
    expect(colored.availableDateKeys).toBe(original.availableDateKeys);
  });

  it("enriches older snapshots using their unique calendar ID prefix", () => {
    const colored = withCalendarSourceColors(agenda([event()]), sourceColors);

    expect(colored.events[0].sourceColor).toBe("#7986CB");
  });

  it("enriches a newer colorless snapshot without changing refresh chronology", () => {
    const bundled = agenda([event({ sourceCalendarId: venueId, sourceColor: "#7986CB" })]);
    const newer = { ...agenda([event()]), generatedAt: "2026-10-12T16:01:00.000Z" };
    const selected = getNewerCalendarAgenda(
      { "ivy-station": newer },
      "ivy-station",
      bundled,
      Date.parse("2026-10-12T16:02:00.000Z"),
    );
    const colored = withCalendarSourceColors(selected, sourceColors);

    expect(selected).toBe(newer);
    expect(colored.generatedAt).toBe(newer.generatedAt);
    expect(colored.events[0].sourceColor).toBe("#7986CB");
  });

  it("preserves an already supplied source color", () => {
    const original = agenda([event({ sourceCalendarId: venueId, sourceColor: "#0B8043" })]);

    expect(withCalendarSourceColors(original, sourceColors)).toBe(original);
    expect(original.events[0].sourceColor).toBe("#0B8043");
  });

  it("leaves unknown explicit source identities untouched", () => {
    const original = agenda([event({ sourceCalendarId: "unknown@example.com" })]);

    expect(withCalendarSourceColors(original, sourceColors)).toBe(original);
  });

  it("never matches an unknown source using the calendar name", () => {
    const original = agenda([event({ id: "unknown@example.com:food" })]);

    expect(withCalendarSourceColors(original, sourceColors)).toBe(original);
  });

  it("omits ambiguous older event ID prefixes", () => {
    const original = agenda([event({ id: `${venueId}:sub:food` })]);

    expect(withCalendarSourceColors(original, [
      ...sourceColors,
      { calendarId: `${venueId}:sub`, color: "#0B8043" },
    ])).toBe(original);
  });

  it.each([undefined, "blue", "#ABC", "#7986CB99", " #7986CB"])(
    "does not attach absent or invalid registry colors: %s",
    (color) => {
      const original = agenda([event()]);

      expect(withCalendarSourceColors(original, [{ calendarId: venueId, color }])).toBe(original);
    },
  );

  it("normalizes valid configured hex colors and preserves unchanged event objects", () => {
    const unknown = event({ id: "unknown:food" });
    const colored = withCalendarSourceColors(agenda([event(), unknown]), [
      { calendarId: venueId, color: "#aabbcc" },
    ]);

    expect(colored.events[0].sourceColor).toBe("#AABBCC");
    expect(colored.events[1]).toBe(unknown);
  });
});
