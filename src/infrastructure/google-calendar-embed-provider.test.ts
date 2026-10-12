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
    expect(parsed.calendarSources).toEqual([{ calendarId: "calendar@example.com" }]);
  });

  it("pairs explicit colors with source positions and normalizes six-digit hex", () => {
    const parsed = parseGoogleCalendarEmbed(
      `${validSource}&src=aG9saWRheXNAZXhhbXBsZS5jb20=&color=%23aabbcc&color=%238e24aa`,
    );

    expect(parsed.calendarSources).toEqual([
      { calendarId: "calendar@example.com", color: "#AABBCC" },
      { calendarId: "holidays@example.com", color: "#8E24AA" },
    ]);
  });

  it("does not shift colors when an empty raw source is skipped", () => {
    const parsed = parseGoogleCalendarEmbed(
      "https://calendar.google.com/calendar/embed?src=&src=calendar%40example.com&color=%23FF0000&color=%2300FF00",
    );

    expect(parsed.calendarSources).toEqual([
      { calendarId: "calendar@example.com", color: "#00FF00" },
    ]);
  });

  it("keeps one color when duplicate plain and encoded IDs agree", () => {
    const parsed = parseGoogleCalendarEmbed(
      `${validSource}&src=Y2FsZW5kYXJAZXhhbXBsZS5jb20=&color=%23aabbcc&color=%23AABBCC`,
    );

    expect(parsed.calendarSources).toEqual([
      { calendarId: "calendar@example.com", color: "#AABBCC" },
    ]);
  });

  it.each(["%2300FF00", "invalid"])(
    "omits a conflicting duplicate calendar color: %s",
    (secondColor) => {
      const parsed = parseGoogleCalendarEmbed(
        `${validSource}&src=calendar%40example.com&color=%23FF0000&color=${secondColor}&src=calendar%40example.com&color=%23FF0000`,
      );

      expect(parsed.calendarSources).toEqual([{ calendarId: "calendar@example.com" }]);
    },
  );

  it.each([
    "",
    "&color=%23AABBCC",
    "&color=%23AABBCC&color=%238E24AA&color=%23000000",
  ])("omits absent or incomplete positional colors: %s", (colors) => {
    const parsed = parseGoogleCalendarEmbed(
      `${validSource}&src=holidays%40example.com${colors}`,
    );

    expect(parsed.calendarSources).toEqual([
      { calendarId: "calendar@example.com" },
      { calendarId: "holidays@example.com" },
    ]);
  });

  it.each(["red", "%23fff", "%23AABBCCDD", "rgb(1,2,3)", "%20%23AABBCC", "", "%23123456%3Bbackground%3Ared"])(
    "omits invalid color values without losing valid source mappings: %s",
    (color) => {
      const parsed = parseGoogleCalendarEmbed(
        `${validSource}&src=holidays%40example.com&color=${color}&color=%238E24AA`,
      );

      expect(parsed.calendarSources).toEqual([
        { calendarId: "calendar@example.com" },
        { calendarId: "holidays@example.com", color: "#8E24AA" },
      ]);
    },
  );

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
