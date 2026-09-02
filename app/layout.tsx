import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteFooter } from "@/src/components/site-footer";
import { SiteHeader } from "@/src/components/site-header";
import { siteCatalog } from "@/src/infrastructure/static-site-catalog";

import "./globals.css";

export const metadata: Metadata = {
  title: "LAAW Life",
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
    <html lang="en">
      <body>
        <SiteHeader
          siteName={tenant.displayName}
          tenantId={tenant.id}
          locations={locations}
        />
        <main className="site-main" id="main-content" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
