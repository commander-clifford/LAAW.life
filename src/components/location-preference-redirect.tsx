"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { getLocationPath } from "@/src/application/location-routing";
import type { Location } from "@/src/domain/site";
import { browserLocationPreferenceStore } from "@/src/infrastructure/browser-location-preference-store";

type RedirectLocation = Pick<Location, "id" | "slug">;

type LocationPreferenceRedirectProps = Readonly<{
  defaultLocationId: string;
  locations: readonly RedirectLocation[];
  tenantId: string;
}>;

export function LocationPreferenceRedirect({
  defaultLocationId,
  locations,
  tenantId,
}: LocationPreferenceRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    let isCurrent = true;

    void browserLocationPreferenceStore
      .getLastLocationId(tenantId)
      .then((savedLocationId) => {
        const location =
          locations.find(({ id }) => id === savedLocationId) ??
          locations.find(({ id }) => id === defaultLocationId);

        if (isCurrent && location) {
          router.replace(getLocationPath(location));
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [defaultLocationId, locations, router, tenantId]);

  return (
    <div className="location-page-loading">
      <p role="status">Opening your calendar…</p>
    </div>
  );
}
