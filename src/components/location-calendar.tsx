import type {
  CalendarAgenda,
  CalendarEmbedProvider,
} from "@/src/application/ports";
import { CalendarDisclosure } from "@/src/components/calendar-disclosure";
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
        key={location.id}
        locationId={location.id}
        locationName={location.displayName}
      />
      <CalendarDisclosure
        key={location.id}
        src={embed.src}
        title={`${location.calendarHeading} Calendar`}
      />
    </div>
  );
}
