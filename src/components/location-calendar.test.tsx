import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LocationShoutOut } from "./location-calendar";

describe("LocationShoutOut", () => {
  it.each([undefined, "", " \n\t "])("reserves no markup for %j", (headline) => {
    expect(renderToStaticMarkup(<LocationShoutOut headline={headline} />)).toBe("");
  });

  it("uses non-interactive text and escapes markup", () => {
    expect(renderToStaticMarkup(<LocationShoutOut headline="  <Great job>  " />))
      .toBe('<p class="location-shout-out">&lt;Great job&gt;</p>');
  });
});
