import { describe, expect, it } from "vitest";

import { buildCalendarAgendaFromIcs } from "@/src/infrastructure/google-calendar-agenda-provider";

const calendarFeed = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//LAAW Life//Test Calendar//EN
X-WR-CALNAME:Community calendar
BEGIN:VEVENT
UID:coffee-social
DTSTAMP:20260801T120000Z
DTSTART;TZID=America/Los_Angeles:20260903T090000
DTEND;TZID=America/Los_Angeles:20260903T100000
SUMMARY:Coffee social
LOCATION:Community room
END:VEVENT
BEGIN:VEVENT
UID:evening-class
DTSTAMP:20260801T120000Z
DTSTART;TZID=America/Los_Angeles:20260827T180000
DTEND;TZID=America/Los_Angeles:20260827T190000
RRULE:FREQ=WEEKLY;COUNT=3
SUMMARY:Evening class
END:VEVENT
BEGIN:VEVENT
UID:overnight-event
DTSTAMP:20260801T120000Z
DTSTART:20260904T020000Z
DTEND:20260904T040000Z
SUMMARY:Evening screening
END:VEVENT
BEGIN:VEVENT
UID:resident-week
DTSTAMP:20260801T120000Z
DTSTART;VALUE=DATE:20260903
DTEND;VALUE=DATE:20260905
SUMMARY:Resident appreciation
END:VEVENT
BEGIN:VEVENT
UID:canceled-event
DTSTAMP:20260801T120000Z
DTSTART;TZID=America/Los_Angeles:20260903T120000
DTEND;TZID=America/Los_Angeles:20260903T130000
STATUS:CANCELLED
SUMMARY:Canceled lunch
END:VEVENT
END:VCALENDAR`;

describe("Google Calendar agenda provider", () => {
  it("collects timed, all-day, overnight, and recurring events for today", () => {
    const agenda = buildCalendarAgendaFromIcs({
      feeds: [{ body: calendarFeed, calendarKey: "community" }],
      now: new Date("2026-09-03T19:00:00.000Z"),
      timeZone: "America/Los_Angeles",
    });
    const todayEvents = agenda.events.filter((event) =>
      event.dateKeys.includes("2026-09-03"),
    );

    expect(agenda.initialDateKey).toBe("2026-09-03");
    expect(todayEvents.map((event) => event.title)).toEqual([
      "Resident appreciation",
      "Coffee social",
      "Evening class",
      "Evening screening",
    ]);
    expect(todayEvents[0].dateKeys).toEqual(["2026-09-03", "2026-09-04"]);
    expect(todayEvents[1]).toMatchObject({
      location: "Community room",
      sourceName: "Community calendar",
      start: "2026-09-03T16:00:00.000Z",
    });
    expect(agenda.events.some((event) => event.title === "Canceled lunch")).toBe(
      false,
    );
  });

  it("preserves partial-feed status for the module's recovery message", () => {
    const agenda = buildCalendarAgendaFromIcs({
      failedSourceCount: 1,
      feeds: [{ body: calendarFeed, calendarKey: "community" }],
      now: new Date("2026-09-03T19:00:00.000Z"),
      sourceCount: 2,
      timeZone: "America/Los_Angeles",
    });

    expect(agenda.failedSourceCount).toBe(1);
    expect(agenda.sourceCount).toBe(2);
  });

  it("omits cancelled occurrence overrides and excluded recurrence dates", () => {
    const body = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:weekly-trivia
DTSTART;TZID=America/Los_Angeles:20260901T183000
DTEND;TZID=America/Los_Angeles:20260901T203000
RRULE:FREQ=WEEKLY;COUNT=3
EXDATE;TZID=America/Los_Angeles:20260915T183000
SUMMARY:Trivia
END:VEVENT
BEGIN:VEVENT
UID:weekly-trivia
RECURRENCE-ID;TZID=America/Los_Angeles:20260908T183000
DTSTART;TZID=America/Los_Angeles:20260908T183000
DTEND;TZID=America/Los_Angeles:20260908T203000
STATUS:CANCELLED
SUMMARY:Cancelled trivia
END:VEVENT
END:VCALENDAR`;
    const agenda = buildCalendarAgendaFromIcs({
      feeds: [{ body, calendarKey: "community" }],
      now: new Date("2026-09-01T19:00:00.000Z"),
      timeZone: "America/Los_Angeles",
    });

    expect(agenda.events.map((event) => [event.title, event.dateKeys])).toEqual([
      ["Trivia", ["2026-09-01"]],
    ]);
    expect(agenda.generatedAt).toBe("2026-09-01T19:00:00.000Z");
  });

  it("keeps recurring Pacific wall times across daylight saving and includes moved overrides", () => {
    const body = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:weekly-event
DTSTART;TZID=America/Los_Angeles:20261025T180000
DTEND;TZID=America/Los_Angeles:20261025T190000
RRULE:FREQ=WEEKLY;COUNT=3
SUMMARY:Sunday event
END:VEVENT
BEGIN:VEVENT
UID:weekly-event
RECURRENCE-ID;TZID=America/Los_Angeles:20261108T180000
DTSTART;TZID=America/Los_Angeles:20261109T190000
DTEND;TZID=America/Los_Angeles:20261109T200000
SUMMARY:Moved event
END:VEVENT
END:VCALENDAR`;
    const agenda = buildCalendarAgendaFromIcs({
      feeds: [{ body, calendarKey: "community" }],
      now: new Date("2026-10-25T19:00:00.000Z"),
      timeZone: "America/Los_Angeles",
    });

    expect(agenda.events.map((event) => [event.title, event.start, event.dateKeys])).toEqual([
      ["Sunday event", "2026-10-26T01:00:00.000Z", ["2026-10-25"]],
      ["Sunday event", "2026-11-02T02:00:00.000Z", ["2026-11-01"]],
      ["Moved event", "2026-11-10T03:00:00.000Z", ["2026-11-09"]],
    ]);
  });
});
