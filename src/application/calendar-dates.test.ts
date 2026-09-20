import { describe, expect, it } from "vitest";

import {
  dayCardCount,
  getDateKey,
  getDayCardDates,
} from "@/src/application/calendar-dates";

describe("calendar civil dates", () => {
  it("builds exactly seven forward-looking dates with their relative labels", () => {
    expect(dayCardCount).toBe(7);
    expect(getDayCardDates("2026-09-15")).toEqual([
      { dateKey: "2026-09-15", dayOffset: 0, relativeLabel: "Today" },
      { dateKey: "2026-09-16", dayOffset: 1, relativeLabel: "Tomorrow" },
      { dateKey: "2026-09-17", dayOffset: 2, relativeLabel: "In 2 days" },
      { dateKey: "2026-09-18", dayOffset: 3, relativeLabel: "In 3 days" },
      { dateKey: "2026-09-19", dayOffset: 4, relativeLabel: "In 4 days" },
      { dateKey: "2026-09-20", dayOffset: 5, relativeLabel: "In 5 days" },
      { dateKey: "2026-09-21", dayOffset: 6, relativeLabel: "In 6 days" },
    ]);
  });

  it.each([
    ["2026-03-07", [
      "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10",
      "2026-03-11", "2026-03-12", "2026-03-13",
    ]],
    ["2026-10-29", [
      "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
      "2026-11-02", "2026-11-03", "2026-11-04",
    ]],
    ["2028-02-27", [
      "2028-02-27", "2028-02-28", "2028-02-29", "2028-03-01",
      "2028-03-02", "2028-03-03", "2028-03-04",
    ]],
    ["2026-12-29", [
      "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01",
      "2027-01-02", "2027-01-03", "2027-01-04",
    ]],
  ])("keeps a contiguous civil-date window from %s", (start, expectedDateKeys) => {
    const dateKeys = getDayCardDates(start).map(({ dateKey }) => dateKey);

    expect(dateKeys).toEqual(expectedDateKeys);
  });

  it.each([
    ["2026-03-08T07:59:59.000Z", "2026-03-07"],
    ["2026-03-08T08:00:00.000Z", "2026-03-08"],
    ["2026-11-01T06:59:59.000Z", "2026-10-31"],
    ["2026-11-01T07:00:00.000Z", "2026-11-01"],
  ])("derives %s as Pacific date %s", (timestamp, expectedDateKey) => {
    expect(getDateKey(new Date(timestamp), "America/Los_Angeles")).toBe(
      expectedDateKey,
    );
  });
});
