import { describe, expect, it } from "vitest";

import { getNewerCalendarAgenda } from "@/src/application/calendar-agenda";
import { getDayCardDates } from "@/src/application/calendar-dates";
import type { CalendarAgenda } from "@/src/application/ports";

const availableDateKeys = getDayCardDates("2026-09-15").map(
  ({ dateKey }) => dateKey,
);
const bundled: CalendarAgenda = {
  availableDateKeys,
  events: [],
  failedSourceCount: 0,
  generatedAt: "2026-09-15T08:00:00.000Z",
  initialDateKey: "2026-09-15",
  sourceCount: 1,
  timeZone: "America/Los_Angeles",
};
const updated: CalendarAgenda = {
  ...bundled,
  generatedAt: "2026-09-15T09:00:00.000Z",
  events: [{
    allDay: false,
    dateKeys: ["2026-09-15"],
    end: "2026-09-16T03:30:00.000Z",
    id: "trivia",
    location: null,
    sourceName: "Community calendar",
    start: "2026-09-16T01:30:00.000Z",
    title: "Trivia",
  }],
};
const now = Date.parse("2026-09-15T09:00:00.000Z");
const select = (agenda: unknown, current = bundled) =>
  getNewerCalendarAgenda({ "ivy-station": agenda }, "ivy-station", current, now);

describe("remote calendar agenda validation", () => {
  it("accepts a newer complete agenda for the selected location", () => {
    expect(select(updated)).toBe(updated);
  });

  it("keeps the last good agenda when a source rolls back or an update repeats", () => {
    expect(select(bundled, updated)).toBe(updated);
    expect(select(updated, updated)).toBe(updated);
  });

  it.each([
    null,
    {},
    { ...updated, generatedAt: undefined },
    { ...updated, generatedAt: "2026-09-15T10:00:00.000Z" },
    { ...updated, timeZone: "Asia/Tokyo" },
    { ...updated, sourceCount: 2 },
    { ...updated, failedSourceCount: 1 },
    { ...updated, availableDateKeys: ["2026-02-31"] },
    { ...updated, events: [{ ...updated.events[0], end: "invalid" }] },
    { ...updated, events: [{ ...updated.events[0], end: "2026-09-31T03:30:00.000Z" }] },
    { ...updated, events: [{ ...updated.events[0], end: "2026-09-15T00:00:00.000Z" }] },
    { ...updated, events: [{ ...updated.events[0], dateKeys: ["2026-09-22"] }] },
    { ...updated, events: [updated.events[0], updated.events[0]] },
  ])("preserves the bundled fallback for malformed or incomplete data: %j", (candidate) => {
    expect(select(candidate)).toBe(bundled);
  });

  it("does not use another location's agenda", () => {
    expect(getNewerCalendarAgenda({ hawthorne: updated }, "ivy-station", bundled, now)).toBe(bundled);
  });

  it.each([0, 3, 6])(
    "rejects a newer snapshot missing required day offset %i",
    (missingOffset) => {
      const incomplete = {
        ...updated,
        availableDateKeys: updated.availableDateKeys.filter(
          (_, index) => index !== missingOffset,
        ),
      };

      expect(select(incomplete)).toBe(bundled);
    },
  );
});
