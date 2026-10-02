import type { CalendarAgendaItem } from "@/src/application/ports";

export function getFeaturedDayEvent(
  events: readonly CalendarAgendaItem[],
  dateKey: string,
): CalendarAgendaItem | null {
  const candidates = events.filter(event =>
    event.dateKeys.includes(dateKey) && event.metadata?.takeover?.enabled,
  );
  candidates.sort((left, right) =>
    (right.metadata?.takeover?.priority ?? 0) - (left.metadata?.takeover?.priority ?? 0) ||
    left.start.localeCompare(right.start) || left.id.localeCompare(right.id),
  );
  return candidates[0] ?? null;
}
