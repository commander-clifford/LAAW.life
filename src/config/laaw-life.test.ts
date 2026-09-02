import { createHash } from "node:crypto";

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

    expect(
      laawLifeTenant.locations.map(({ calendar }) =>
        createHash("sha256").update(calendar.src).digest("hex"),
      ),
    ).toEqual([
      "9112372d84478994f3bac17d88e389d0b50ae6bcc17bd04f21c894176d327ea6",
      "5a6a09780e6da675955457ec3d45d2c3f6f662077e8c5f5cbb9d6b7daea87a44",
    ]);

    for (const location of laawLifeTenant.locations) {
      expect(googleCalendarEmbedProvider.getEmbed(location.calendar)).toEqual({
        src: location.calendar.src,
      });
    }
  });
});
