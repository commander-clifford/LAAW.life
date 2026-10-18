import type {
  CalendarAgenda,
  CalendarEmbedProvider,
} from "@/src/application/ports";
import { EventRowPrototype } from "@/src/components/event-row-prototype";
import { CalendarDisclosure } from "@/src/components/calendar-disclosure";
import { LiveCalendarSchedule } from "@/src/components/live-calendar-schedule";
import type { Location } from "@/src/domain/site";
import { parseGoogleCalendarEmbed } from "@/src/infrastructure/google-calendar-source";

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
  const { calendarSources } = parseGoogleCalendarEmbed(embed.src);

  return (
    <div className="location-page">
        <EventRowPrototype>
          <LiveCalendarSchedule
            agenda={agenda}
            key={location.id}
            locationId={location.id}
            locationName={location.displayName}
            sourceColors={calendarSources}
          />
        </EventRowPrototype>
      <CalendarDisclosure
        key={location.id}
        src={embed.src}
        title={`${location.calendarHeading} Calendar`}
      />
    </div>
  );
}
