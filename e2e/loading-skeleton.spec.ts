import { expect, test, type Page } from "@playwright/test";

async function geometry(page: Page, loading: boolean) {
  return page.evaluate(isLoading => {
    const card = document.querySelector(isLoading ? ".day-card-loading" : "[data-day-card][data-active='true']")!;
    const box = (element: Element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    return {
      card: box(card), header: box(card.querySelector(".day-card-heading")!),
      body: box(card.querySelector(".day-card-schedule-frame")!),
      navigation: box(document.querySelector(".day-carousel-pagination")!),
      search: box(document.querySelector("section:has(input[type=search])")!),
      footer: box(document.querySelector(".site-footer")!),
    };
  }, loading);
}

for (const width of [320, 393, 1440]) for (const appearance of ["light", "dark"] as const) for (const textScale of width === 320 ? [100, 200] : [100]) {
  test(`full-card skeleton reserves loaded geometry at ${width}px ${appearance} ${textScale}% text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: appearance, reducedMotion: "no-preference" });
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(/\/_next\/static\/.*\.js(?:\?|$)/, async route => { await gate; await route.continue(); });
    try {
      await page.goto("ivy/", { waitUntil: "commit" });
      const skeleton = page.locator(".day-card-loading");
      await expect(skeleton).toBeVisible();
      if (textScale === 200) await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      await expect(skeleton).toHaveText("");
      await expect(skeleton).toHaveAttribute("aria-hidden", "true");
      await expect(page.locator(".day-carousel")).toHaveAttribute("aria-busy", "true");
      await expect(page.locator(".day-carousel").getByRole("status")).toHaveClass("visually-hidden");
      await expect(page.locator(".day-carousel button")).toHaveCount(0);
      await expect(page.locator(".day-carousel-loading-dot > span")).toHaveCount(8);
      await expect(page.getByRole("searchbox", { name: "Search events" })).toBeDisabled();
      await expect(page.getByRole("searchbox", { name: "Search events" })).toHaveAttribute("placeholder", "");
      expect(await page.locator("section[data-loading=true] svg").evaluateAll(elements => elements.every(element => getComputedStyle(element).visibility === "hidden"))).toBe(true);
      await expect(page.locator(".day-carousel-loading-dot[data-active=true] > span")).toHaveCSS("width", textScale === 200 ? "48px" : "24px");
      const markerPositions = await page.locator(".day-carousel-loading-dot > span").evaluateAll(elements => elements.map(element => {
        const r = element.getBoundingClientRect();return { x: r.x, y: r.y, width: r.width, height: r.height, color: getComputedStyle(element).backgroundColor, opacity: getComputedStyle(element).opacity };
      }));
      const headerColor = await page.locator(".day-card-loading .day-card-heading").evaluate(element => getComputedStyle(element).backgroundColor);
      for (const marker of markerPositions) { expect(marker.color).toBe(headerColor); expect(marker.opacity).toBe("1"); }
      expect(await page.locator(".day-carousel-loading-dot > span").first().evaluate(element => getComputedStyle(element, "::after").animationName)).toBe("none");
      const before = await geometry(page, true);
      for (const selector of [".day-card-loading", ".schedule-loading-surface"]) {
        const shimmer = await page.locator(selector).first().evaluate(element => {
          const s = getComputedStyle(element, "::after");const r = element.getBoundingClientRect();
          return { animation: s.animationName, background: s.backgroundImage, width: parseFloat(s.width), height: parseFloat(s.height), actualWidth: r.width, actualHeight: r.height };
        });
        expect(shimmer.animation).toBe("schedule-shimmer");
        expect(shimmer.background).toContain("linear-gradient");
        expect(shimmer.width).toBeCloseTo(shimmer.actualWidth, 0);
        expect(shimmer.height).toBeCloseTo(shimmer.actualHeight, 0);
      }
      release();
      await expect(page.locator(".day-carousel")).toHaveAttribute("aria-busy", "false");
      const after = await geometry(page, false);
      await expect(page.locator(".day-carousel-pagination button[aria-current=true] > span")).toHaveCSS("width", textScale === 200 ? "48px" : "24px");
      const loadedMarkers = await page.locator(".day-carousel-pagination button > span").evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
      expect(loadedMarkers).toHaveLength(markerPositions.length);
      for (const [index, marker] of loadedMarkers.entries()) for (const key of ["x", "y", "width", "height"] as const) expect(marker[key]).toBeCloseTo(markerPositions[index][key], 0);
      expect(after.navigation.width).toBeCloseTo(before.navigation.width, 0);
      expect(after.navigation.height).toBeCloseTo(before.navigation.height, 0);
      for (const region of ["card", "search", "footer"] as const) {
        expect(after[region].y, `${region} top`).toBeCloseTo(before[region].y, 0);
        expect(after[region].height, `${region} height`).toBeCloseTo(before[region].height, 0);
      }
      expect(after.body.height).toBeGreaterThan(100);
      if (textScale === 100) for (const region of ["header", "body"] as const) {
        expect(after[region].height, region).toBeCloseTo(before[region].height, 0);
      }
      await expect(page.getByRole("searchbox", { name: "Search events" })).toBeEnabled();
      await expect(page.getByRole("searchbox", { name: "Search events" })).toHaveAttribute("placeholder", "Search events");
    } finally { release(); }
  });
}

for (const motion of ["device", "setting"] as const) {
  test(`loading shimmer stops for reduced motion from ${motion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: motion === "device" ? "reduce" : "no-preference" });
    if (motion === "setting") await page.addInitScript(() => localStorage.setItem("laaw-life:motion:v1", "reduce"));
    let release!: () => void;const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(/\/_next\/static\/.*\.js(?:\?|$)/, async route => { await gate; await route.continue(); });
    try {
      await page.goto("ivy/", { waitUntil: "commit" });
      await expect(page.locator(".day-card-loading")).toBeVisible();
      for (const selector of [".day-card-loading", ".schedule-loading-surface"]) {
        expect(await page.locator(selector).first().evaluate(element => getComputedStyle(element, "::after").animationName)).toBe("none");
      }
    } finally { release(); }
  });
}
