import { LocationPreferenceRedirect } from "@/src/components/location-preference-redirect";
import { siteCatalog } from "@/src/infrastructure/static-site-catalog";

export default async function Home() {
  const tenant = await siteCatalog.getDefaultTenant();
  const locations = tenant.locations.map(({ id, slug }) => ({ id, slug }));

  return (
    <LocationPreferenceRedirect
      defaultLocationId={tenant.defaultLocationId}
      locations={locations}
      tenantId={tenant.id}
    />
  );
}
