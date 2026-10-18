import type { Location, Tenant } from "@/src/domain/site";

type LocationRoute = Pick<Location, "slug">;

export function getLocationPath(location: LocationRoute): string {
  return `/${location.slug}`;
}

export function getLocationBySlug(
  tenant: Tenant,
  slug: string,
): Location | null {
  return tenant.locations.find((location) => location.slug === slug) ?? null;
}

export function getPreferredLocation<
  TLocation extends Pick<Location, "id">,
>(
  tenant: Readonly<{
    defaultLocationId: string;
    id: string;
    locations: readonly TLocation[];
  }>,
  savedLocationId: string | null,
): TLocation {
  const savedLocation = tenant.locations.find(
    (location) => location.id === savedLocationId,
  );

  if (savedLocation) {
    return savedLocation;
  }

  const defaultLocation = tenant.locations.find(
    (location) => location.id === tenant.defaultLocationId,
  );

  if (!defaultLocation) {
    throw new Error(
      `Default location ${tenant.defaultLocationId} is not configured for ${tenant.id}`,
    );
  }

  return defaultLocation;
}

export function getLocationSlugFromPath(
  pathname: string,
  locations: readonly Pick<Location, "slug">[],
): string | null {
  const finalSegment = pathname.split("/").filter(Boolean).at(-1);

  return locations.some((location) => location.slug === finalSegment)
    ? (finalSegment ?? null)
    : null;
}
