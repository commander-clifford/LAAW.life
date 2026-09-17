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

    const redirectToPreferredLocation = async () => {
      try {
        const savedLocationId =
          await browserLocationPreferenceStore.getLastLocationId(tenantId);
        if (isCurrent && savedLocationId === "og") {
          // The original is a static document outside the Next.js route tree.
          window.location.replace(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/og/${window.location.search}${window.location.hash}`);
          return;
        }
        const location =
          locations.find(({ id }) => id === savedLocationId) ??
          locations.find(({ id }) => id === defaultLocationId);

        if (isCurrent && location) {
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
