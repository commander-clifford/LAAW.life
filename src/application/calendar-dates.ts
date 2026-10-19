export const dayCardCount = 7;

export type DayCardDate = Readonly<{
  dateKey: string;
  dayOffset: number;
  relativeLabel: string;
}>;

export function getDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    calendar: "gregory",
    day: "2-digit",
    month: "2-digit",
    numberingSystem: "latn",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

export function getDayCardDates(
  todayDateKey: string,
  count = dayCardCount,
): readonly DayCardDate[] {
  return Array.from({ length: count }, (_, dayOffset) => ({
    dateKey: addDaysToDateKey(todayDateKey, dayOffset),
    dayOffset,
    relativeLabel: dayOffset === 0 ? "Today" : dayOffset === 1 ? "Tomorrow" : `In ${dayOffset} days`,
  }));
}
