import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteHeader } from "@/src/components/site-header";
import { GoogleAnalytics } from "@/src/components/google-analytics";
import { siteCatalog } from "@/src/infrastructure/static-site-catalog";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LAAW Life",
    template: "%s | LAAW Life",
  },
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function RootLayout({ children }: RootLayoutProps) {
  const tenant = await siteCatalog.getDefaultTenant();
  const locations = tenant.locations.map(({ id, slug, displayName }) => ({
    id,
    slug,
    displayName,
  }));

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("laaw-life:theme:v1");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch{}` }} />
      </head>
      <body>
        <GoogleAnalytics />
        <SiteHeader
          siteName={tenant.displayName}
          tenantId={tenant.id}
          locations={locations}
        >
          {children}
        </SiteHeader>
      </body>
    </html>
  );
}
