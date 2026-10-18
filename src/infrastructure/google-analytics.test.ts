import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  googleAnalyticsScript,
  trackGoogleAnalyticsEvent,
  trackLocationSwitch,
  trackOgLinkOpen,
} from "./google-analytics";

describe("Google Analytics bootstrap", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("forwards custom events only through the initialized tag", () => {
    const calls: unknown[][] = [];
    vi.stubGlobal("window", {
      gtag: (...args: unknown[]) => calls.push(args),
    });

    trackGoogleAnalyticsEvent("carousel_navigation", {
      from_index: 0,
      interaction_method: "arrow",
      location_id: "ivy-station",
      to_index: 1,
    });
    trackLocationSwitch("ivy", "hawthorne");
    trackOgLinkOpen("hawthorne");

    expect(calls).toEqual([
      ["event", "carousel_navigation", {
        from_index: 0,
        interaction_method: "arrow",
        location_id: "ivy-station",
        to_index: 1,
      }],
      ["event", "location_switch", {
        from_location: "ivy",
        to_location: "hawthorne",
      }],
      ["event", "og_link_open", { from_location: "hawthorne" }],
    ]);

    vi.stubGlobal("window", {});
    expect(() => trackGoogleAnalyticsEvent(
      "carousel_navigation",
      { interaction_method: "arrow" },
    )).not.toThrow();
  });
});
