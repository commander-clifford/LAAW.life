import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getLocationBySlug } from "@/src/application/location-routing";
import { LocationCalendar } from "@/src/components/location-calendar";
import { getGeneratedCalendarAgenda } from "@/src/infrastructure/generated-calendar-agenda-store";
import { googleCalendarEmbedProvider } from "@/src/infrastructure/google-calendar-embed-provider";
import { siteCatalog } from "@/src/infrastructure/static-site-catalog";

type LocationPageProps = Readonly<{
  params: Promise<{
    location: string;
  }>;
}>;

export const dynamicParams = false;

export async function generateStaticParams() {
  const tenant = await siteCatalog.getDefaultTenant();

  return tenant.locations.map((location) => ({
    location: location.slug,
  }));
}

export async function generateMetadata({
  params,
}: LocationPageProps): Promise<Metadata> {
  const tenant = await siteCatalog.getDefaultTenant();
  const { location: slug } = await params;
  const location = getLocationBySlug(tenant, slug);

  if (!location) {
    notFound();
  }

  return {
    title: `${location.displayName} Calendar`,
    description: `View the ${location.displayName} calendar for LAAW Life.`,
  };
}

export default async function LocationPage({ params }: LocationPageProps) {
  const tenant = await siteCatalog.getDefaultTenant();
  const { location: slug } = await params;
  const location = getLocationBySlug(tenant, slug);

  if (!location) {
    notFound();
  }

  const agenda = await getGeneratedCalendarAgenda(location.id);

  return (
    <LocationCalendar
      agenda={agenda}
      calendarProvider={googleCalendarEmbedProvider}
      location={location}
    />
  );
}
