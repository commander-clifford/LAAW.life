import { describe, expect, it } from "vitest";
import { searchCalendarEvents } from "@/src/application/calendar-search";
import { buildCalendarAgendaFromIcs } from "@/src/infrastructure/google-calendar-agenda-provider";

const agenda = buildCalendarAgendaFromIcs({
  now: new Date("2026-10-02T12:00:00Z"), timeZone: "America/Los_Angeles",
  feeds: [{ calendarKey: "test", body: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:past
DTSTART:20260102T180000Z
DTEND:20260102T190000Z
SUMMARY:Tacos lunch
DESCRIPTION:Football club supporters
LOCATION:Community room
END:VEVENT
BEGIN:VEVENT
UID:future
DTSTART:20271202T180000Z
DTEND:20271202T190000Z
SUMMARY:Watch party
DESCRIPTION:Seahawks football club
END:VEVENT
END:VCALENDAR` }],
});

describe("calendar search", () => {
  it("searches downloaded historical and distant future event details", () => {
    expect(agenda.availableDateKeys[0]).toBe("2026-01-02");
    expect(agenda.availableDateKeys.at(-1)).toBe("2027-12-02");
    expect(searchCalendarEvents(agenda.events, "FOOTBALL club").map(event => event.title)).toEqual(["Tacos lunch", "Watch party"]);
    expect(searchCalendarEvents(agenda.events, "seahawks")[0].title).toBe("Watch party");
  });
  it("searches location and title, requires every word, and handles empty/no-match queries", () => {
    expect(searchCalendarEvents(agenda.events, "community tacos")).toHaveLength(1);
    expect(searchCalendarEvents(agenda.events, "tacos seahawks")).toEqual([]);
    expect(searchCalendarEvents(agenda.events, "   ")).toEqual([]);
  });
});

it("includes the end of the last finite recurring occurrence", () => {
  const finite = buildCalendarAgendaFromIcs({
    now: new Date("2026-10-02T12:00:00Z"), timeZone: "America/Los_Angeles",
    feeds: [{ calendarKey: "test", body: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:finite
DTSTART:20271201T180000Z
DTEND:20271204T190000Z
RRULE:FREQ=WEEKLY;COUNT=2
SUMMARY:Festival
END:VEVENT
END:VCALENDAR` }],
  });
  expect(finite.availableDateKeys.at(-1)).toBe("2027-12-11");
  expect(finite.events).toHaveLength(2);
  expect(finite.events[1].dateKeys.at(-1)).toBe("2027-12-11");
});
