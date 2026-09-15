import type {
  CalendarAgenda,
  CalendarEmbedProvider,
} from "@/src/application/ports";
import { CalendarEmbed } from "@/src/components/calendar-embed";
import { LiveCalendarSchedule } from "@/src/components/live-calendar-schedule";
import type { Location } from "@/src/domain/site";

type LocationCalendarProps = Readonly<{
  agenda: CalendarAgenda;
  calendarProvider: CalendarEmbedProvider;
  location: Location;
}>;

export function LocationCalendar({
  agenda,
  calendarProvider,
  location,
}: LocationCalendarProps) {
  const embed = calendarProvider.getEmbed(location.calendar);

  return (
    <div className="location-page">
      <LiveCalendarSchedule
        agenda={agenda}
        locationId={location.id}
        locationName={location.displayName}
      />
      <CalendarEmbed
        key={location.id}
        src={embed.src}
        title={`${location.calendarHeading} Calendar`}
      />
    </div>
  );
}
