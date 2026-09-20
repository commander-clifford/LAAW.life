const relativeDayLabels = [
  "Today",
  "Tomorrow",
  "In 2 days",
  "In 3 days",
  "In 4 days",
  "In 5 days",
  "In 6 days",
] as const;

export const dayCardCount = relativeDayLabels.length;

export type DayCardDate = Readonly<{
  dateKey: string;
  dayOffset: number;
  relativeLabel: (typeof relativeDayLabels)[number];
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

export function getDayCardDates(todayDateKey: string): readonly DayCardDate[] {
  return relativeDayLabels.map((relativeLabel, dayOffset) => ({
    dateKey: addDaysToDateKey(todayDateKey, dayOffset),
    dayOffset,
    relativeLabel,
  }));
}
