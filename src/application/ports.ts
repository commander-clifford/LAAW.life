import type {
  CalendarSource,
  Tenant,
  VisitorIdentity,
} from "@/src/domain/site";

export type CalendarEmbed = Readonly<{
  src: string;
}>;

export type CalendarAgendaItem = Readonly<{
  allDay: boolean;
  dateKeys: readonly string[];
  end: string;
  id: string;
  location: string | null;
  sourceName: string;
  start: string;
  title: string;
}>;

export type CalendarAgenda = Readonly<{
  availableDateKeys: readonly string[];
  events: readonly CalendarAgendaItem[];
  failedSourceCount: number;
  generatedAt: string;
  initialDateKey: string;
  sourceCount: number;
  timeZone: string;
}>;

export interface CalendarAgendaProvider {
  getAgenda(source: CalendarSource): Promise<CalendarAgenda>;
}

export interface CalendarEmbedProvider {
  getEmbed(source: CalendarSource): CalendarEmbed;
}

export interface SiteCatalog {
  getDefaultTenant(): Promise<Tenant>;
}

// The current adapter is device-local; a cookie or database can replace it later.
export interface LocationPreferenceStore {
  getLastLocationId(tenantId: string): Promise<string | null>;
  setLastLocationId(tenantId: string, locationId: string | null): Promise<void>;
}

// Authentication remains outside the page until the product needs accounts.
export interface IdentityProvider {
  getCurrentIdentity(): Promise<VisitorIdentity | null>;
}
