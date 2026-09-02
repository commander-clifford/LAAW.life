import type { SiteCatalog } from "@/src/application/ports";
import { laawLifeTenant } from "@/src/config/laaw-life";

export const siteCatalog: SiteCatalog = {
  getDefaultTenant: async () => laawLifeTenant,
};
