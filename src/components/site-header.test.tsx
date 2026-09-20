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

  it("renders a closed inert drawer and one header toggle before hydration", () => {
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
    expect(drawerTag).not.toContain('role="dialog"');
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
    expect(html.match(/data-page-canvas=""/g)).toHaveLength(2);
    expect(html).toContain("<footer");
    expect(html).toContain("Buy me a brew");
    const originalLinkTag = html.match(
      /<a[^>]*class="original-link"[^>]*>/,
    )?.[0];
    expect(originalLinkTag).toContain('href="/og/"');
    expect(originalLinkTag).toContain('target="_blank"');
    expect(originalLinkTag).toContain('rel="noopener noreferrer"');
    expect(html).toContain("OG Regular<svg");
    expect(html).not.toContain("Start here next time");
    expect(html).not.toContain('type="radio"');
    expect(html).not.toContain(">Current<");
    expect(html).toContain('class="location-drawer-settings"');
    const footer = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"));
    expect(footer).toContain("Brewed by ");
    expect(footer).toContain('aria-haspopup="dialog">Clifford</a>.');
    expect(footer).not.toContain("brew</");
    expect(footer).not.toContain("—");
    expect(footer).not.toContain("<nav");
    expect(footer).not.toContain("github.com");
    expect(footer).not.toContain("Appearance");
    expect(html).toContain(
      '<a class="skip-link" href="#main-content">Skip to main content</a>',
    );
    expect(html).not.toContain("Skip to calendar");
    expect(html).not.toContain("Choose a location");
    expect(html).not.toContain("location-drawer-title");
    expect(html).toContain('aria-label="Location calendars"');
    expect(html).not.toContain('role="complementary"');
    expect(html).not.toContain("aria-modal");
    expect(html).not.toContain('aria-label="Close location navigation"');
    expect(html).not.toContain('class="drawer-close"');
    expect(html).toContain(
      '<div class="drawer-overlay" aria-hidden="true"></div>',
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
