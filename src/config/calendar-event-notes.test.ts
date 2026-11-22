import { describe, expect, it } from "vitest";
import { getCalendarEventNote } from "./calendar-event-notes";

const closure = "c_998g12g73ffcp0rb7k49tklt2o@group.calendar.google.com:75ilakpmp1nmpsgucl1pdpao4s@google.com:2026-11-21T20:00:00.000Z";

describe("calendar event notes", () => {
  it("attaches the exact wording to only the Ivy closure occurrence", () => {
    expect(getCalendarEventNote("ivy-station", "2026-11-21", closure)).toBe("Congratulations LAL Jerks");
    expect(getCalendarEventNote("hawthorne", "2026-11-21", closure)).toBeNull();
    expect(getCalendarEventNote("ivy-station", "2026-11-22", closure)).toBeNull();
    expect(getCalendarEventNote("ivy-station", "2026-11-21", "another-event")).toBeNull();
  });
});
