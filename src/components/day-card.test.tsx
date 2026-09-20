import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalendarAgenda, CalendarAgendaItem } from "@/src/application/ports";
import { DayCard } from "@/src/components/day-card";

const dateKey = "2026-09-19";

function event(
  id: string,
  start: string,
  end: string,
  title: string,
): CalendarAgendaItem {
  return {
    allDay: false,
    dateKeys: [dateKey],
    end,
    id,
    location: null,
    sourceName: "Test calendar",
    start,
    title,
  };
}

describe("DayCard event times", () => {
  it("keeps two-digit minutes while sharing matching meridiems", () => {
    const agenda: CalendarAgenda = {
      availableDateKeys: [dateKey],
      events: [
        event("afternoon", "2026-09-19T20:00:00.000Z", "2026-09-20T04:00:00.000Z", "Afternoon"),
        event("midday", "2026-09-19T18:00:00.000Z", "2026-09-19T20:00:00.000Z", "Midday"),
        event("midnight", "2026-09-20T00:00:00.000Z", "2026-09-20T07:00:00.000Z", "Midnight"),
      ],
      failedSourceCount: 0,
      generatedAt: "2026-09-19T19:00:00.000Z",
      initialDateKey: dateKey,
      sourceCount: 1,
      timeZone: "America/Los_Angeles",
    };

    const html = renderToStaticMarkup(
      <DayCard
        agenda={agenda}
        dateKey={dateKey}
        index={0}
        isActive
        relativeLabel="Today"
      />,
    );

    expect(html).toContain(">1:00–9:00 PM</time>");
    expect(html).toContain(">11:00 AM–1:00 PM</time>");
    expect(html).toContain(">5:00 PM–12:00 AM</time>");
    expect(html).toContain('aria-label="1:00 PM to 9:00 PM"');
    expect(html).toContain('data-overflow="false"');
    expect(html).toContain('data-at-start="true"');
    expect(html).toContain('data-at-end="true"');
    expect(html).toContain(
      'class="day-card-schedule-fade day-card-schedule-fade-top"',
    );
    expect(html).toContain(
      'class="day-card-schedule-fade day-card-schedule-fade-bottom"',
    );
    expect(html).not.toContain('tabindex="0"');
    expect(html).not.toContain("Scroll vertically to view more events.");
    expect(html).not.toContain("9/20/2026");
  });

  it("names both zones when a range crosses the repeated DST hour", () => {
    const fallbackDateKey = "2026-11-01";
    const fallbackEvent = event(
      "fallback",
      "2026-11-01T08:30:00.000Z",
      "2026-11-01T09:30:00.000Z",
      "Clock change",
    );
    const agenda: CalendarAgenda = {
      availableDateKeys: [fallbackDateKey],
      events: [{ ...fallbackEvent, dateKeys: [fallbackDateKey] }],
      failedSourceCount: 0,
      generatedAt: "2026-11-01T08:00:00.000Z",
      initialDateKey: fallbackDateKey,
      sourceCount: 1,
      timeZone: "America/Los_Angeles",
    };

    const html = renderToStaticMarkup(
      <DayCard
        agenda={agenda}
        dateKey={fallbackDateKey}
        index={0}
        isActive
        relativeLabel="Today"
      />,
    );

    expect(html).toContain(">1:30 AM PDT–1:30 AM PST</time>");
    expect(html).toContain(
      'aria-label="1:30 AM PDT to 1:30 AM PST"',
    );
    expect(html).toContain('data-compact="false"');
  });
});
