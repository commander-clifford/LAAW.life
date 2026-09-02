import type {
  CalendarSource,
  Tenant,
  VisitorIdentity,
} from "@/src/domain/site";

export type CalendarEmbed = Readonly<{
  src: string;
}>;

export interface CalendarProvider {
  getEmbed(source: CalendarSource): CalendarEmbed;
}

export interface SiteCatalog {
  getDefaultTenant(): Promise<Tenant>;
}

// The current adapter is device-local; a cookie or database can replace it later.
export interface LocationPreferenceStore {
  getLastLocationId(tenantId: string): Promise<string | null>;
  setLastLocationId(tenantId: string, locationId: string): Promise<void>;
}

// Authentication remains outside the page until the product needs accounts.
export interface IdentityProvider {
  getCurrentIdentity(): Promise<VisitorIdentity | null>;
}
