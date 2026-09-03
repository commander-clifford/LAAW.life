import type { CalendarProvider } from "@/src/application/ports";
import { CalendarEmbed } from "@/src/components/calendar-embed";
import type { Location } from "@/src/domain/site";

type LocationCalendarProps = Readonly<{
  calendarProvider: CalendarProvider;
  location: Location;
}>;

export function LocationCalendar({
  calendarProvider,
  location,
}: LocationCalendarProps) {
  const embed = calendarProvider.getEmbed(location.calendar);
  const headingId = `${location.slug}-calendar-heading`;

  return (
    <section className="location-page" aria-labelledby={headingId}>
      <h1 id={headingId}>{location.calendarHeading}</h1>
      <CalendarEmbed
        key={location.id}
        fallbackHref={embed.fallbackHref}
        src={embed.src}
        title={`${location.calendarHeading} Calendar`}
      />
    </section>
  );
}
