import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalendarAgenda } from "@/src/application/ports";
import { laawLifeTenant } from "@/src/config/laaw-life";
import { LocationCalendar } from "@/src/components/location-calendar";
import { googleCalendarEmbedProvider } from "@/src/infrastructure/google-calendar-embed-provider";

const agenda: CalendarAgenda = {
  availableDateKeys: [
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
    "2026-09-06",
    "2026-09-07",
    "2026-09-08",
    "2026-09-09",
  ],
  events: [
    {
      allDay: false,
      dateKeys: ["2026-09-03"],
      end: "2026-09-03T18:00:00.000Z",
      id: "test-calendar:test-event:2026-09-03T17:00:00.000Z",
      location: "Community room",
      sourceName: "Community calendar",
      start: "2026-09-03T17:00:00.000Z",
      title: "Coffee social",
    },
  ],
  failedSourceCount: 0,
  generatedAt: "2026-09-03T19:00:00.000Z",
  initialDateKey: "2026-09-03",
  sourceCount: 1,
  timeZone: "America/Los_Angeles",
};

describe("LocationCalendar", () => {
  for (const location of laawLifeTenant.locations) {
    it(`renders only the ${location.displayName} calendar`, () => {
      const html = renderToStaticMarkup(
        createElement(LocationCalendar, {
          agenda,
          calendarProvider: googleCalendarEmbedProvider,
          location,
        }),
      );

      expect(html).not.toContain("<iframe");
      expect(html).not.toContain("data-calendar-placeholder");
      expect(html).toContain("Open calendar");
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('class="day-carousel"');
      expect(html).not.toContain("<h2");
      expect(html).toContain('aria-label="Seven-day schedule"');
      expect(html).toContain("Loading today&#x27;s schedule…");
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('role="status"');
      expect(html).not.toContain("day-carousel-pagination");
      expect(html).not.toContain("day-card-relative-label");
      expect(html).not.toContain("<time");
      expect(html).not.toContain("Thursday, September 3, 2026");
      expect(html).not.toContain("Coffee social");
      expect(html).toContain('aria-label="Full calendar"');
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html).toContain(`<h1 class="location-page-heading">${location.displayName}</h1>`);
      expect(html).not.toContain("Loading calendar…");
      expect(html).not.toContain("Times are shown in Pacific Time.");
      expect(html).not.toContain("Trouble viewing the embed");
      expect(html).not.toContain("Open the calendar in a new tab");

      for (const otherLocation of laawLifeTenant.locations) {
        if (otherLocation.id !== location.id) {
          expect(html).not.toContain(
            otherLocation.displayName,
          );
        }
      }
    });
  }
});
