import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/src/components/site-footer";

describe("SiteFooter", () => {
  it("renders the approved plain-text footer copy", () => {
    const html = renderToStaticMarkup(createElement(SiteFooter));

    expect(html).toContain("Clifford gets free beer.");
    expect(html).not.toContain("<a");
    expect(html).not.toMatch(/unofficial|independent|affiliat|endorse/i);
  });
});
