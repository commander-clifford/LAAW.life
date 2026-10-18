import { describe, expect, it } from "vitest";

import { formatCalendarFreshness } from "@/src/application/calendar-freshness";

const now = Date.parse("2026-10-15T12:00:00.000Z");

describe("calendar freshness labels", () => {
  it.each([
    ["2026-10-15T11:59:30.000Z", "Updated just now"],
    ["2026-10-15T11:59:00.000Z", "Updated 1 minute ago"],
    ["2026-10-15T11:01:00.000Z", "Updated 59 minutes ago"],
    ["2026-10-15T11:00:00.000Z", "Updated 1 hour ago"],
    ["2026-10-14T12:01:00.000Z", "Updated 23 hours ago"],
    ["2026-10-14T12:00:00.000Z", "Updated 1 day ago"],
    ["2026-10-13T12:00:00.000Z", "Updated 2 days ago"],
  ])("formats %s as %s", (generatedAt, expected) => {
    expect(formatCalendarFreshness(generatedAt, now)).toBe(expected);
  });

  it.each(["invalid", "2026-10-15T12:00:00.001Z"])(
    "reports unavailable for invalid or future timestamps (%s)",
    (generatedAt) => {
      expect(formatCalendarFreshness(generatedAt, now)).toBe(
        "Update time unavailable",
      );
    },
  );
});
