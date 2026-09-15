import { describe, expect, it } from "vitest";

import { googleCalendarEmbedProvider } from "@/src/infrastructure/google-calendar-embed-provider";
import { parseGoogleCalendarEmbed } from "@/src/infrastructure/google-calendar-source";

const validSource =
  "https://calendar.google.com/calendar/embed?ctz=America%2FLos_Angeles&src=calendar%40example.com";

describe("Google Calendar embed provider", () => {
  it("returns the validated embed URL", () => {
    expect(
      googleCalendarEmbedProvider.getEmbed({
        provider: "google-calendar-embed",
        src: validSource,
      }),
    ).toEqual({
      src: validSource,
    });
  });

  it("deduplicates repeated calendar sources for agenda generation", () => {
    const parsed = parseGoogleCalendarEmbed(
      `${validSource}&src=calendar%40example.com`,
    );

    expect(parsed.calendarIds).toEqual(["calendar@example.com"]);
  });

  it("rejects whitespace or control characters in plain calendar IDs", () => {
    expect(() =>
      parseGoogleCalendarEmbed(
        "https://calendar.google.com/calendar/embed?src=%0Acalendar%40example.com",
      ),
    ).toThrow("Invalid Google Calendar ID");
  });

  it.each([
    "http://calendar.google.com/calendar/embed?src=calendar%40example.com",
    "https://example.com/calendar/embed?src=calendar%40example.com",
    "https://calendar.google.com:444/calendar/embed?src=calendar%40example.com",
    "https://calendar.google.com/calendar/u/0/embed?src=calendar%40example.com",
    "https://calendar.google.com/calendar/embed?ctz=America%2FLos_Angeles",
    "https://calendar.google.com/calendar/embed?src=",
    "not a URL",
  ])("rejects an unsafe or noncanonical URL: %s", (src) => {
    expect(() =>
      googleCalendarEmbedProvider.getEmbed({
        provider: "google-calendar-embed",
        src,
      }),
    ).toThrow("Invalid Google Calendar embed URL");
  });
});
