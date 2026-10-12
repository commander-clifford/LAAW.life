import type {
  CalendarAgenda,
  CalendarSourceColor,
} from "@/src/application/ports";

export function withCalendarSourceColors(
  agenda: CalendarAgenda,
  sourceColors: readonly CalendarSourceColor[],
): CalendarAgenda {
  if (sourceColors.length === 0) return agenda;
  let changed = false;
  const events = agenda.events.map((event) => {
    if (event.sourceColor !== undefined) return event;

    // Older snapshots encode the source ID at the start of each event ID.
    // A supplied source identity is authoritative; never infer from a name.
    const sources = sourceColors.filter(({ calendarId }) =>
      calendarId.length > 0 && (event.sourceCalendarId !== undefined
        ? event.sourceCalendarId === calendarId
        : event.id.startsWith(`${calendarId}:`)),
    );
    const color = sources.length === 1 ? sources[0].color : undefined;
    if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return event;

    changed = true;
    return { ...event, sourceColor: color.toUpperCase() };
  });

  return changed ? { ...agenda, events } : agenda;
}
