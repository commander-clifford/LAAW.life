import { describe, expect, it } from "vitest";
import { getCalendarEventCopy } from "./calendar-event-notes";

const closure = "c_998g12g73ffcp0rb7k49tklt2o@group.calendar.google.com:75ilakpmp1nmpsgucl1pdpao4s@google.com:2026-11-21T20:00:00.000Z";

describe("calendar event notes", () => {
  it("attaches the exact wording to only the Ivy closure occurrence", () => {
    expect(getCalendarEventCopy("ivy-station", "2026-11-21", closure)).toEqual({
      title: "Closed to the public for Lucky Guess Trivia finals",
      note: "Congratulations LA Ale Jerks for second place trivia.",
    });
    expect(getCalendarEventCopy("hawthorne", "2026-11-21", closure)).toBeNull();
    expect(getCalendarEventCopy("ivy-station", "2026-11-22", closure)).toBeNull();
    expect(getCalendarEventCopy("ivy-station", "2026-11-21", "another-event")).toBeNull();
  });
});
