"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  getLocationPath,
  getPreferredLocation,
} from "@/src/application/location-routing";
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

    const redirectToPreferredLocation = async () => {
      try {
        const savedLocationId =
          await browserLocationPreferenceStore.getLastLocationId(tenantId);
        // Only configured modern locations may influence the root redirect.
        // Legacy or otherwise stale values fall back to the configured default.
        const location = getPreferredLocation(
          { defaultLocationId, id: tenantId, locations },
          savedLocationId,
        );

        if (isCurrent) {
          // Keep campaign/source parameters when the home page selects a location.
          router.replace(`${getLocationPath(location)}${window.location.search}${window.location.hash}`);
        }
      } catch {
        // The server-rendered location links remain usable if storage is blocked.
      }
    };

    void redirectToPreferredLocation();

    return () => {
      isCurrent = false;
    };
  }, [defaultLocationId, locations, router, tenantId]);

  return null;
}
