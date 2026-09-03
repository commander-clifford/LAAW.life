import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SiteHeader } from "@/src/components/site-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ivy/",
}));

const locations = [
  { id: "ivy-station", slug: "ivy", displayName: "Ivy Station" },
  { id: "hawthorne", slug: "hawthorne", displayName: "Hawthorne" },
] as const;

describe("SiteHeader", () => {
  it("keeps desktop navigation before the main calendar in focus order", () => {
    const html = renderToStaticMarkup(
      <SiteHeader
        locations={locations}
        siteName="LAAW Life"
        tenantId="laaw-life"
      >
        <a href="#calendar" id="calendar-control">
          Calendar
        </a>
      </SiteHeader>,
    );

    const orderedMarkerIndexes = [
      html.indexOf("<header"),
      html.indexOf('class="site-brand"'),
      html.indexOf('<div class="location-drawer"'),
      html.indexOf('class="location-link"'),
      html.indexOf("<main"),
      html.indexOf('id="calendar-control"'),
    ];

    expect(orderedMarkerIndexes.every((index) => index >= 0)).toBe(true);
    expect(orderedMarkerIndexes).toEqual(
      [...orderedMarkerIndexes].sort((a, b) => a - b),
    );
    expect(html.lastIndexOf('class="location-link"')).toBeLessThan(
      html.indexOf('id="calendar-control"'),
    );
    expect(html.match(/data-page-canvas=""/g)).toHaveLength(3);
    expect(html).toContain(
      '<a class="skip-link" href="#main-content">Skip to main content</a>',
    );
    expect(html).not.toContain("Skip to calendar");
    expect(html).toContain('role="complementary"');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("aria-modal");
    expect(html.match(/aria-label="Close location navigation"/g)).toHaveLength(
      1,
    );
    expect(html).toContain(
      '<div class="drawer-overlay" data-page-canvas="" aria-hidden="true"></div>',
    );
  });
});
