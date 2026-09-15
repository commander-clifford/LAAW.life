import { renderToStaticMarkup } from "react-dom/server";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SiteHeader } from "@/src/components/site-header";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/ivy/"),
}));

const locations = [
  { id: "ivy-station", slug: "ivy", displayName: "Ivy Station" },
  { id: "hawthorne", slug: "hawthorne", displayName: "Hawthorne" },
] as const;

describe("SiteHeader", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/ivy/");
  });

  it("keeps desktop navigation before the main calendar in focus order", () => {
    const html = renderToStaticMarkup(
      <SiteHeader
        locations={locations}
        siteName="LAAW.life"
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
    expect(html).not.toContain("<h1");
    expect(html.slice(html.indexOf("<header"), html.indexOf("</header>"))).not.toContain("Ivy Station");
    expect(html).toContain(
      '<a class="site-brand" href="/">LAAW.life</a>',
    );
    expect(orderedMarkerIndexes).toEqual(
      [...orderedMarkerIndexes].sort((a, b) => a - b),
    );
    expect(html.lastIndexOf('class="location-link"')).toBeLessThan(
      html.indexOf('id="calendar-control"'),
    );
    expect(html.match(/data-page-canvas=""/g)).toHaveLength(4);
    expect(html.indexOf('<footer')).toBeGreaterThan(html.indexOf('</main>'));
    expect(html).toContain('href="/og/" aria-label="OG — original LAAW.life site">OG</a>');
    expect(html).toContain(
      '<a class="skip-link" href="#main-content">Skip to main content</a>',
    );
    expect(html).not.toContain("Skip to calendar");
    expect(html).not.toContain("Choose a location");
    expect(html).not.toContain("location-drawer-title");
    expect(html).toContain('aria-label="Location navigation"');
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

  it.each(["/", "/missing-page/", "/missing/ivy/"])(
    "leaves the main heading to the page at %s",
    (pathname) => {
      vi.mocked(usePathname).mockReturnValue(pathname);
      const html = renderToStaticMarkup(
        <SiteHeader locations={locations} siteName="LAAW.life" tenantId="laaw-life">
          <h1>Page heading</h1>
        </SiteHeader>,
      );

      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html).not.toContain("site-location-heading");
    },
  );
});
