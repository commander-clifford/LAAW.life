import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { laawLifeTenant } from "@/src/config/laaw-life";
import { LocationCalendar } from "@/src/components/location-calendar";
import { googleCalendarEmbedProvider } from "@/src/infrastructure/google-calendar-embed-provider";

describe("LocationCalendar", () => {
  for (const location of laawLifeTenant.locations) {
    it(`renders only the ${location.displayName} calendar`, () => {
      const html = renderToStaticMarkup(
        createElement(LocationCalendar, {
          calendarProvider: googleCalendarEmbedProvider,
          location,
        }),
      );

      expect(html).not.toContain("<iframe");
      expect(html).toContain("data-calendar-placeholder");
      expect(html).toContain(location.calendarHeading);
      expect(html).toContain("Loading calendar…");
      expect(html).toContain("Times are shown in Pacific Time.");
      expect(html).toContain("Open the calendar in a new tab");
      expect(html).toContain('target="_blank"');
      expect(html).toContain(location.calendar.src.replaceAll("&", "&amp;"));

      for (const otherLocation of laawLifeTenant.locations) {
        if (otherLocation.id !== location.id) {
          expect(html).not.toContain(
            otherLocation.calendar.src.replaceAll("&", "&amp;"),
          );
        }
      }
    });
  }
});
