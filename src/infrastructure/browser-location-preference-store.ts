import type { LocationPreferenceStore } from "@/src/application/ports";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;
type StorageProvider = () => PreferenceStorage | null;

function getPreferenceKey(tenantId: string): string {
  return `laaw-life:${tenantId}:last-location:v1`;
}

export function createLocationPreferenceStore(
  getStorage: StorageProvider,
): LocationPreferenceStore {
  return {
    async getLastLocationId(tenantId) {
      try {
        return getStorage()?.getItem(getPreferenceKey(tenantId)) || null;
      } catch {
        return null;
      }
    },
    async setLastLocationId(tenantId, locationId) {
      try {
        getStorage()?.setItem(getPreferenceKey(tenantId), locationId ?? "");
      } catch {
        // Browsing modes that disable storage should not block navigation.
      }
    },
  };
}

export const browserLocationPreferenceStore = createLocationPreferenceStore(
  () => {
    try {
      return typeof window === "undefined" ? null : window.localStorage;
    } catch {
      return null;
    }
  },
);
