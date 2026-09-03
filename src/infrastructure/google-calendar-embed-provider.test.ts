import { describe, expect, it } from "vitest";

import { googleCalendarEmbedProvider } from "@/src/infrastructure/google-calendar-embed-provider";

const validSource =
  "https://calendar.google.com/calendar/embed?ctz=America%2FLos_Angeles&src=calendar%40example.com";

describe("Google Calendar embed provider", () => {
  it("returns validated embed and recovery URLs", () => {
    expect(
      googleCalendarEmbedProvider.getEmbed({
        provider: "google-calendar-embed",
        src: validSource,
      }),
    ).toEqual({
      fallbackHref: validSource,
      src: validSource,
    });
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
