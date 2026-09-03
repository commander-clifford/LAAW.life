import type { Metadata } from "next";
import Link from "next/link";

import { getLocationPath } from "@/src/application/location-routing";
import { LocationPreferenceRedirect } from "@/src/components/location-preference-redirect";
import { siteCatalog } from "@/src/infrastructure/static-site-catalog";

export const metadata: Metadata = {
  title: {
    absolute: "Choose a location | LAAW Life",
  },
};

export default async function Home() {
  const tenant = await siteCatalog.getDefaultTenant();
  const redirectLocations = tenant.locations.map(({ id, slug }) => ({
    id,
    slug,
  }));

  return (
    <section
      className="location-page location-choice-page"
      aria-labelledby="location-choice-heading"
    >
      <h1 id="location-choice-heading">Choose a location</h1>
      <p>Select a location to open its calendar.</p>
      <ul className="location-choice-list">
        {tenant.locations.map((location) => (
          <li key={location.id}>
            <Link
              className="location-choice-link"
              href={getLocationPath(location)}
            >
              {location.displayName}
            </Link>
          </li>
        ))}
      </ul>
      <LocationPreferenceRedirect
        defaultLocationId={tenant.defaultLocationId}
        locations={redirectLocations}
        tenantId={tenant.id}
      />
    </section>
  );
}
