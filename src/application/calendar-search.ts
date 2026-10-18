import type { CalendarAgendaItem } from "@/src/application/ports";

export function searchCalendarEvents(events: readonly CalendarAgendaItem[], query: string): CalendarAgendaItem[] {
  const terms = query.trim().toLocaleLowerCase("en-US").split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return events.filter((event) => {
    const text = [event.title, event.description ?? "", event.location ?? "", event.sourceName].join(" ").toLocaleLowerCase("en-US");
    return terms.every((term) => text.includes(term));
  }).sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}
