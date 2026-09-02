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

      expect(html.match(/<iframe/g)).toHaveLength(1);
      expect(html).toContain(location.calendarHeading);
      expect(html).toContain(
        `title="${location.calendarHeading} Calendar"`,
      );
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
