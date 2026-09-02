import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { laawLifeTenant } from "@/src/config/laaw-life";
import { CalendarSite } from "@/src/components/calendar-site";
import { googleCalendarEmbedProvider } from "@/src/infrastructure/google-calendar-embed-provider";

describe("CalendarSite", () => {
  it("renders every configured location in order", () => {
    const html = renderToStaticMarkup(
      createElement(CalendarSite, {
        calendarProvider: googleCalendarEmbedProvider,
        tenant: laawLifeTenant,
      }),
    );

    expect(html.match(/<iframe/g)).toHaveLength(2);
    expect(html.indexOf("Ivy Station Calendar")).toBeLessThan(
      html.indexOf("Hawthorne Calendar"),
    );

    for (const location of laawLifeTenant.locations) {
      expect(html).toContain(location.calendarHeading);
      expect(html).toContain(location.calendar.src.replaceAll("&", "&amp;"));
    }
  });
});
