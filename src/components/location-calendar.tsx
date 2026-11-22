import type {
  CalendarAgenda,
  CalendarEmbedProvider,
} from "@/src/application/ports";
import { EventRowPrototype } from "@/src/components/event-row-prototype";
import { CalendarDisclosure } from "@/src/components/calendar-disclosure";
import { LiveCalendarSchedule } from "@/src/components/live-calendar-schedule";
import { getCalendarLocationClassName } from "@/src/components/calendar-source-styles";
import type { Location } from "@/src/domain/site";
import { parseGoogleCalendarEmbed } from "@/src/infrastructure/google-calendar-source";

// Clear this value to remove the shout-out without reserving any space.
const IVY_SHOUT_OUT = "Congratulations LA Ale Jerks for second place trivia.";

export function LocationShoutOut({ headline }: Readonly<{ headline?: string }>) {
  const text = headline?.trim();
  return text ? <p className="location-shout-out">{text}</p> : null;
}

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
    <div className={`location-page ${getCalendarLocationClassName(location.id)}`}>
      <LocationShoutOut headline={location.id === "ivy-station" ? IVY_SHOUT_OUT : undefined} />
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
