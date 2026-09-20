import type { CalendarAgenda, CalendarAgendaItem } from "@/src/application/ports";
import {
  getDateKey,
  getDayCardDates,
} from "@/src/application/calendar-dates";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function isAgendaItem(value: unknown, availableDates: Set<string>): value is CalendarAgendaItem {
  return isRecord(value) &&
    typeof value.allDay === "boolean" &&
    typeof value.id === "string" && value.id.length > 0 &&
    typeof value.title === "string" &&
    typeof value.sourceName === "string" &&
    (value.location === null || typeof value.location === "string") &&
    isTimestamp(value.start) && isTimestamp(value.end) &&
    Date.parse(value.end) >= Date.parse(value.start) &&
    Array.isArray(value.dateKeys) && value.dateKeys.length > 0 &&
    value.dateKeys.every((date: unknown) => isDateKey(date) && availableDates.has(date));
}

function isCalendarAgenda(
  value: unknown,
  timeZone: string,
  requiredDateKeys: readonly string[],
  expectedSourceCount: number,
): value is CalendarAgenda {
  if (!isRecord(value) || value.timeZone !== timeZone ||
    !isTimestamp(value.generatedAt) || !isDateKey(value.initialDateKey) ||
    value.sourceCount !== expectedSourceCount ||
    value.failedSourceCount !== 0 ||
    !Array.isArray(value.availableDateKeys) || value.availableDateKeys.length === 0 ||
    !value.availableDateKeys.every(isDateKey) ||
    !value.availableDateKeys.includes(value.initialDateKey) ||
    !Array.isArray(value.events)) {
    return false;
  }

  const availableDates = new Set<string>(value.availableDateKeys);
  return requiredDateKeys.every((dateKey) => availableDates.has(dateKey)) &&
    value.events.every((event: unknown) => isAgendaItem(event, availableDates)) &&
    new Set(value.events.map((event: CalendarAgendaItem) => event.id)).size === value.events.length;
}

// A failed, malformed, partial, or older remote snapshot must never replace the
// complete agenda that the page is already displaying.
export function getNewerCalendarAgenda(
  payload: unknown,
  locationId: string,
  current: CalendarAgenda,
  now: number,
): CalendarAgenda {
  if (!isRecord(payload)) return current;
  const candidate = payload[locationId];
  const currentDateKey = getDateKey(new Date(now), current.timeZone);
  const requiredDateKeys = getDayCardDates(currentDateKey).map(
    ({ dateKey }) => dateKey,
  );
  if (!isCalendarAgenda(
    candidate,
    current.timeZone,
    requiredDateKeys,
    current.sourceCount,
  )) return current;

  const generatedAt = Date.parse(candidate.generatedAt);
  const currentGeneratedAt = Date.parse(current.generatedAt);
  if (generatedAt > now + 5 * 60_000 ||
    (Number.isFinite(currentGeneratedAt) && generatedAt <= currentGeneratedAt)) {
    return current;
  }

  return candidate;
}
