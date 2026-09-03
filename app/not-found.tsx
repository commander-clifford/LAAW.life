import type { Metadata } from "next";
import Link from "next/link";

import { getLocationPath } from "@/src/application/location-routing";
import { siteCatalog } from "@/src/infrastructure/static-site-catalog";

export const metadata: Metadata = {
  title: "Page not found",
  description: "Choose a LAAW Life location to find the calendar you need.",
};

export default async function NotFound() {
  const tenant = await siteCatalog.getDefaultTenant();

  return (
    <section className="not-found-page" aria-labelledby="not-found-heading">
      <p className="not-found-code">404</p>
      <h1 id="not-found-heading">Page not found</h1>
      <p>
        That page isn&apos;t available. Choose a LAAW Life location to keep
        browsing.
      </p>
      <ul className="not-found-actions">
        {tenant.locations.map((location) => (
          <li key={location.id}>
            <Link
              className="not-found-link"
              href={getLocationPath(location)}
            >
              {`View ${location.displayName} calendar`}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
