import { describe, expect, it } from "vitest";
import { rememberCalendarAgenda, restoreCalendarAgenda } from "./calendar-cache";
import { getDayCardDates } from "./calendar-dates";
import type { CalendarAgenda } from "./ports";
const now = Date.parse("2026-09-15T09:00:00.000Z");
const bundled: CalendarAgenda = {
  availableDateKeys: getDayCardDates("2026-09-15").map(({ dateKey }) => dateKey),
  events: [], failedSourceCount: 0, generatedAt: "2026-09-15T08:00:00.000Z",
  initialDateKey: "2026-09-15", sourceCount: 1, timeZone: "America/Los_Angeles",
};
const fresh = { ...bundled, generatedAt: new Date(now).toISOString() };
describe("last-good calendar cache", () => {
  it("keeps location data isolated and survives remounts", () => {
    rememberCalendarAgenda("ivy-cache", fresh);
    expect(restoreCalendarAgenda("ivy-cache", bundled, now)).toBe(fresh);
    expect(restoreCalendarAgenda("hawthorne-cache", bundled, now)).toBe(bundled);
  });
  it("restores validated stored data after reload", () => {
    const storage = { getItem: () => JSON.stringify(fresh), setItem: () => {} };
    expect(restoreCalendarAgenda("reload", bundled, now, storage)).toEqual(fresh);
  });
  it("rejects invalid, older and future stored snapshots", () => {
    for (const [index, value] of [null, { ...fresh, failedSourceCount: 1 },
      { ...fresh, generatedAt: "2026-09-14T09:00:00.000Z" },
      { ...fresh, generatedAt: "2027-09-15T09:00:00.000Z" }].entries()) {
      expect(restoreCalendarAgenda(`invalid-${index}`, bundled, now, {
        getItem: () => JSON.stringify(value), setItem: () => {},
      })).toBe(bundled);
    }
  });
  it("retains memory fallback when storage is denied or full", () => {
    const storage = { getItem: () => { throw Error("denied"); }, setItem: () => { throw Error("quota"); } };
    expect(() => rememberCalendarAgenda("quota", fresh, storage)).not.toThrow();
    expect(restoreCalendarAgenda("quota", bundled, now, storage)).toBe(fresh);
  });
  it("stores only the provided public agenda under its location key", () => {
    const writes: Array<[string, string]> = [];
    rememberCalendarAgenda("ivy-privacy", fresh, {
      getItem: () => null,
      setItem: (key, value) => { writes.push([key, value]); },
    });
    expect(writes).toEqual([["laaw:calendar:v1:ivy-privacy", JSON.stringify(fresh)]]);
    expect(Object.keys(JSON.parse(writes[0][1]))).toEqual(Object.keys(fresh));
  });

});
