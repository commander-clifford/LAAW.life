export type GoogleCalendarEmbedSource = Readonly<{
  provider: "google-calendar-embed";
  src: string;
}>;

export type CalendarSource = GoogleCalendarEmbedSource;

export type Location = Readonly<{
  id: string;
  slug: string;
  calendarHeading: string;
  calendar: CalendarSource;
}>;

export type Tenant = Readonly<{
  id: string;
  slug: string;
  displayName: string;
  locations: readonly Location[];
}>;

export type VisitorIdentity = Readonly<{
  id: string;
}>;
