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

  it("renders a closed inert modal drawer before hydration at every width", () => {
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

    const drawerTag = html.match(/<div[^>]*id="location-drawer"[^>]*>/)?.[0];
    const openerTag = html.match(/<button[^>]*class="navigation-toggle"[^>]*>/)?.[0];

    expect(drawerTag).toBeDefined();
    expect(drawerTag).toContain('role="dialog"');
    expect(drawerTag).toContain('aria-hidden="true"');
    expect(drawerTag).toContain('inert=""');
    expect(drawerTag).not.toContain("aria-modal");
    expect(openerTag).toContain('aria-controls="location-drawer"');
    expect(openerTag).toContain('aria-expanded="false"');
    expect(openerTag).toContain('aria-haspopup="dialog"');
    expect(openerTag).toContain('disabled=""');
    expect(html).not.toContain("<h1");
    expect(html.slice(html.indexOf("<header"), html.indexOf("</header>"))).not.toContain("Ivy Station");
    expect(html).toContain(
      '<a class="site-brand" href="/">LAAW.life</a>',
    );
    expect(html.match(/data-page-canvas=""/g)).toHaveLength(4);
    expect(html).toContain("<footer");
    expect(html).toContain("Buy Clifford a beer");
    expect(html).toContain('href="/og/">OG Regular</a>');
    expect(html).toContain("<legend>Start here next time</legend>");
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html).not.toContain("checked=");
    expect(html).toContain(
      '<a class="skip-link" href="#main-content">Skip to main content</a>',
    );
    expect(html).not.toContain("Skip to calendar");
    expect(html).not.toContain("Choose a location");
    expect(html).not.toContain("location-drawer-title");
    expect(html).toContain('aria-label="Location navigation"');
    expect(html).not.toContain('role="complementary"');
    expect(html).not.toContain("aria-modal");
    expect(html.match(/aria-label="Close location navigation"/g)).toHaveLength(
      1,
    );
    expect(html).toContain(
      '<div class="drawer-overlay" data-page-canvas="" aria-hidden="true"></div>',
    );
  });

  it.each([
    ["/ivy/", "Ivy Station"],
    ["/hawthorne/", "Hawthorne"],
  ])("marks the current location inside the closed drawer at %s", (pathname, name) => {
    vi.mocked(usePathname).mockReturnValue(pathname);
    const html = renderToStaticMarkup(
      <SiteHeader locations={locations} siteName="LAAW.life" tenantId="laaw-life">
        <h1>{name}</h1>
      </SiteHeader>,
    );

    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    const currentLink = html.match(/<a\b[^>]*aria-current="page"[^>]*>(.*?)<\/a>/)?.[1];
    expect(currentLink).toContain(`<span>${name}</span>`);
    expect(html).toContain('id="main-content" tabindex="-1"');
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
