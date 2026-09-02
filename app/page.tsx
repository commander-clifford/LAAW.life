import { CalendarSite } from "@/src/components/calendar-site";
import { googleCalendarEmbedProvider } from "@/src/infrastructure/google-calendar-embed-provider";
import { siteCatalog } from "@/src/infrastructure/static-site-catalog";

export default async function Home() {
  const tenant = await siteCatalog.getDefaultTenant();

  return (
    <CalendarSite
      calendarProvider={googleCalendarEmbedProvider}
      tenant={tenant}
    />
  );
}
