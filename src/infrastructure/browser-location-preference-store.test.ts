import { describe, expect, it } from "vitest";

import { createLocationPreferenceStore } from "@/src/infrastructure/browser-location-preference-store";

describe("browser location preference store", () => {
  it("stores preferences under tenant-specific keys", async () => {
    const values = new Map<string, string>();
    const store = createLocationPreferenceStore(() => ({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    }));

    await store.setLastLocationId("laaw-life", "hawthorne");
    await store.setLastLocationId("another-tenant", "ivy-station");

    await expect(store.getLastLocationId("laaw-life")).resolves.toBe(
      "hawthorne",
    );
    await expect(store.getLastLocationId("another-tenant")).resolves.toBe(
      "ivy-station",
    );
    expect([...values.keys()]).toEqual([
      "laaw-life:laaw-life:last-location:v1",
      "laaw-life:another-tenant:last-location:v1",
    ]);
    await store.setLastLocationId("laaw-life", "og");
    await expect(store.getLastLocationId("laaw-life")).resolves.toBe("og");
    await store.setLastLocationId("laaw-life", null);
    await expect(store.getLastLocationId("laaw-life")).resolves.toBeNull();
  });

  it("treats unavailable or blocked storage as an empty preference", async () => {
    const unavailableStore = createLocationPreferenceStore(() => null);
    const blockedStore = createLocationPreferenceStore(() => ({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    }));

    await expect(
      unavailableStore.getLastLocationId("laaw-life"),
    ).resolves.toBeNull();
    await expect(
      blockedStore.getLastLocationId("laaw-life"),
    ).resolves.toBeNull();
    await expect(
      blockedStore.setLastLocationId("laaw-life", "ivy-station"),
    ).resolves.toBeUndefined();
  });
});
