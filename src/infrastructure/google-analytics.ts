/** Only a verified GA4 web-stream ID should enable the production tag. */
export function googleAnalyticsScript(measurementId: string | undefined): string | null {
  const id = measurementId?.trim();
  if (!id) return null;
  if (!/^G-[A-Z0-9]+$/.test(id)) {
    throw new Error("NEXT_PUBLIC_GA_MEASUREMENT_ID must be a GA4 measurement ID (G-…).");
  }

  return `
    (() => {
      if (!['laaw.life', 'www.laaw.life'].includes(window.location.hostname)) return;
      if (window.__laawAnalyticsInitialized) return;
      window.__laawAnalyticsInitialized = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', ${JSON.stringify(id)}, {
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ${JSON.stringify(id)};
      document.head.appendChild(script);
    })();
  `;
}

/** Record a deliberate switch from one location calendar to the other. */
export function trackLocationSwitch(
  fromLocation: string,
  toLocation: string,
): void {
  if (typeof window === "undefined") return;

  const gtag = (window as Window & {
    gtag?: (...args: unknown[]) => void;
  }).gtag;
  gtag?.("event", "location_switch", {
    from_location: fromLocation,
    to_location: toLocation,
  });
}
