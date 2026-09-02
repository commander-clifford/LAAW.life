import { describe, expect, it } from "vitest";

import {
  getLocationBySlug,
  getLocationPath,
  getLocationSlugFromPath,
  getPreferredLocation,
} from "@/src/application/location-routing";
import { laawLifeTenant } from "@/src/config/laaw-life";

describe("location routing", () => {
  it("builds route paths and finds configured locations", () => {
    const ivy = getLocationBySlug(laawLifeTenant, "ivy");

    expect(ivy?.id).toBe("ivy-station");
    expect(ivy && getLocationPath(ivy)).toBe("/ivy");
    expect(getLocationBySlug(laawLifeTenant, "unknown")).toBeNull();
  });

  it("uses a valid saved location and falls back to the configured default", () => {
    expect(getPreferredLocation(laawLifeTenant, "hawthorne").slug).toBe(
      "hawthorne",
    );
    expect(getPreferredLocation(laawLifeTenant, null).slug).toBe("ivy");
    expect(getPreferredLocation(laawLifeTenant, "retired-location").slug).toBe(
      "ivy",
    );
  });

  it("rejects a missing default location", () => {
    expect(() =>
      getPreferredLocation(
        { ...laawLifeTenant, defaultLocationId: "missing" },
        null,
      ),
    ).toThrow(/Default location missing is not configured/);
  });

  it("recognizes location paths with or without a hosting base path", () => {
    const locations = laawLifeTenant.locations;

    expect(getLocationSlugFromPath("/ivy/", locations)).toBe("ivy");
    expect(getLocationSlugFromPath("/LAAW.life/hawthorne/", locations)).toBe(
      "hawthorne",
    );
    expect(getLocationSlugFromPath("/LAAW.life/", locations)).toBeNull();
    expect(getLocationSlugFromPath("/unknown/", locations)).toBeNull();
  });
});
