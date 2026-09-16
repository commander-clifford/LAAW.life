import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

import { googleAnalyticsScript } from "./google-analytics";

describe("Google Analytics bootstrap", () => {
  it("does nothing without an ID and rejects malformed configuration", () => {
    expect(googleAnalyticsScript(undefined)).toBeNull();
    expect(googleAnalyticsScript(" ")).toBeNull();
    expect(() => googleAnalyticsScript("G-x';alert(1)")).toThrow();
    expect(() => googleAnalyticsScript("123456")).toThrow();
  });

  it.each(["localhost", "127.0.0.1", "commander-clifford.github.io", "laaw.life.example.com"])(
    "never loads the tag on %s", (hostname) => {
      const context = { window: { location: { hostname } } };
      // No document is provided: any attempt to fetch a tag would throw.
      runInNewContext(googleAnalyticsScript("G-TESTONLY")!, context);
      expect(context.window).not.toHaveProperty("gtag");
    },
  );

  it.each(["laaw.life", "www.laaw.life"])(
    "initializes once on %s without a second page-view event", (hostname) => {
      const appended: Record<string, unknown>[] = [];
      const context = {
        window: { location: { hostname }, dataLayer: [] as unknown[][] },
        document: {
          createElement: () => ({}),
          head: { appendChild: (script: Record<string, unknown>) => appended.push(script) },
        },
      };
      const script = googleAnalyticsScript("G-TESTONLY")!;
      runInNewContext(script, context);
      runInNewContext(script, context);
      expect(appended).toEqual([{
        async: true,
        src: "https://www.googletagmanager.com/gtag/js?id=G-TESTONLY",
      }]);
      const commands = context.window.dataLayer.map((args) => Array.from(args));
      expect(commands).toHaveLength(2);
      expect(commands[0][0]).toBe("js");
      expect(commands[1]).toEqual(["config", "G-TESTONLY", {
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      }]);
    },
  );
});
