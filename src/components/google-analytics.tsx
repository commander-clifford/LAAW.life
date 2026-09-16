import Script from "next/script";

import { googleAnalyticsScript } from "@/src/infrastructure/google-analytics";

export function GoogleAnalytics() {
  const script = googleAnalyticsScript(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

  if (process.env.NODE_ENV !== "production" || !script) return null;

  // GA4 enhanced measurement owns page/history views and outbound clicks.
  // Do not also send page_view events from a pathname effect.
  return <Script id="laaw-google-analytics" strategy="afterInteractive">{script}</Script>;
}
