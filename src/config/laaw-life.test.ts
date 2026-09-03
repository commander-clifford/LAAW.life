import { describe, expect, it } from "vitest";

import { laawLifeTenant } from "@/src/config/laaw-life";
import { googleCalendarEmbedProvider } from "@/src/infrastructure/google-calendar-embed-provider";

describe("LAAW Life configuration", () => {
  it("keeps locations data-driven and preserves the existing calendars", () => {
    expect(laawLifeTenant.locations.map(({ slug }) => slug)).toEqual([
      "ivy",
      "hawthorne",
    ]);
    expect(laawLifeTenant.defaultLocationId).toBe("ivy-station");
    expect(
      laawLifeTenant.locations.map(({ calendarHeading }) => calendarHeading),
    ).toEqual(["Ivy Station", "Hawthorne"]);
    expect(new Set(laawLifeTenant.locations.map(({ id }) => id)).size).toBe(
      laawLifeTenant.locations.length,
    );
    expect(new Set(laawLifeTenant.locations.map(({ slug }) => slug)).size).toBe(
      laawLifeTenant.locations.length,
    );

    const calendarUrls = laawLifeTenant.locations.map(
      ({ calendar }) => new URL(calendar.src),
    );
    const calendarSourcesByLocation = calendarUrls.map((url) =>
      url.searchParams
        .getAll("src")
        .map((source) => Buffer.from(source, "base64").toString("utf8")),
    );
    const calendarSources = calendarSourcesByLocation.flat();

    expect(
      calendarUrls.map((url) => url.searchParams.getAll("src").length),
    ).toEqual([8, 8]);
    expect(new Set(calendarSources).size).toBe(10);
    expect(calendarSourcesByLocation).toEqual([
      [
        "c_998g12g73ffcp0rb7k49tklt2o@group.calendar.google.com",
        "nfl_24_%4cos+%41ngeles+%43hargers#sports@group.v.calendar.google.com",
        "gfh6tqtg3dal933622rdpvqs70@group.calendar.google.com",
        "7lvuqen1dk09j26qsb1m7j5l4c@group.calendar.google.com",
        "nhl_8_%4cos+%41ngeles+%4bings#sports@group.v.calendar.google.com",
        "nfl_14_%4cos+%41ngeles+%52ams#sports@group.v.calendar.google.com",
        "ncaaf_64_%55%43%4c%41+%42ruins#sports@group.v.calendar.google.com",
        "ncaaf_62_%55%53%43+%54rojans#sports@group.v.calendar.google.com",
      ],
      [
        "h45lb52k2q98f6l7ip777f1agg@group.calendar.google.com",
        "nfl_24_%4cos+%41ngeles+%43hargers#sports@group.v.calendar.google.com",
        "gfh6tqtg3dal933622rdpvqs70@group.calendar.google.com",
        "7lvuqen1dk09j26qsb1m7j5l4c@group.calendar.google.com",
        "nfl_14_%4cos+%41ngeles+%52ams#sports@group.v.calendar.google.com",
        "ncaaf_64_%55%43%4c%41+%42ruins#sports@group.v.calendar.google.com",
        "ncaaf_62_%55%53%43+%54rojans#sports@group.v.calendar.google.com",
        "en.usa#holiday@group.v.calendar.google.com",
      ],
    ]);

    for (const location of laawLifeTenant.locations) {
      const url = new URL(location.calendar.src);
      const colors = url.searchParams.getAll("color");

      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("calendar.google.com");
      expect(url.pathname).toBe("/calendar/embed");
      expect(url.searchParams.get("ctz")).toBe("America/Los_Angeles");
      expect(url.searchParams.get("showTz")).toBe("0");
      if (colors.length > 0) {
        expect(colors).toHaveLength(url.searchParams.getAll("src").length);
      }
      expect(googleCalendarEmbedProvider.getEmbed(location.calendar)).toEqual(
        {
          fallbackHref: location.calendar.src,
          src: location.calendar.src,
        },
      );
    }
  });
});
