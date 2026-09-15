"use client";

import { useCallback, useSyncExternalStore } from "react";

import type {
  CalendarAgenda,
  CalendarAgendaItem,
} from "@/src/application/ports";

const clockCheckIntervalMilliseconds = 60_000;

// Static HTML cannot know the visitor's current date. Keep the server and
// hydration render identical, including avoiding runtime-specific Intl output.
function getServerDateKey(): null {
  return null;
}

type TodayScheduleProps = Readonly<{
  agenda: CalendarAgenda;
}>;

function getDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

function formatEventTime(
  event: CalendarAgendaItem,
  dateKey: string,
  timeZone: string,
): string {
  if (event.allDay) {
    return "All day";
  }

  const start = new Date(event.start);
  const end = new Date(event.end);
  const startDateKey = getDateKey(start, timeZone);
  const endDateKey = getDateKey(
    new Date(Math.max(start.getTime(), end.getTime() - 1)),
    timeZone,
  );

  if (startDateKey < dateKey) {
    return `Until ${formatTime(end, timeZone)}`;
  }

  if (endDateKey > dateKey) {
    return `From ${formatTime(start, timeZone)}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).formatRange(start, end);
}

export function TodaySchedule({
  agenda,
}: TodayScheduleProps) {
  const subscribeToClock = useCallback((notify: () => void) => {
    const interval = window.setInterval(
      notify,
      clockCheckIntervalMilliseconds,
    );

    return () => window.clearInterval(interval);
  }, []);
  const getCurrentDateKey = useCallback(
    () => getDateKey(new Date(), agenda.timeZone),
    [agenda.timeZone],
  );
  const currentDateKey = useSyncExternalStore<string | null>(
    subscribeToClock,
    getCurrentDateKey,
    getServerDateKey,
  );
  const dateLine = (
    <p
      className="today-schedule-date"
      aria-hidden={currentDateKey === null || undefined}
    >
      {currentDateKey === null ? null : (
        <time dateTime={currentDateKey}>{formatDate(currentDateKey)}</time>
      )}
    </p>
  );
  if (currentDateKey === null) {
    return (
      <>
        {dateLine}
        <section
          className="today-schedule"
          aria-label="Daily events"
          aria-busy="true"
        >
          <p className="today-schedule-message" role="status">
            Loading today&apos;s schedule…
          </p>
        </section>
      </>
    );
  }

  const isDateAvailable = agenda.availableDateKeys.includes(currentDateKey);
  const hasNoAvailableSources =
    agenda.sourceCount > 0 &&
    agenda.failedSourceCount === agenda.sourceCount;
  const events = agenda.events.filter((event) =>
    event.dateKeys.includes(currentDateKey),
  );

  return (
    <>
      {dateLine}
      <section
        className="today-schedule"
        aria-label="Daily events"
        aria-busy="false"
      >
        <div aria-live="polite">
          {!isDateAvailable || hasNoAvailableSources ? (
            <p className="today-schedule-message">
              Today&apos;s schedule is temporarily unavailable. The full calendar
              is still available below.
            </p>
          ) : events.length === 0 ? (
            <p className="today-schedule-message">
              Nothing is scheduled for today.
            </p>
          ) : (
            <ol className="today-event-list">
              {events.map((event) => (
                <li className="today-event" key={event.id}>
                  <time
                    className="today-event-time"
                    dateTime={event.allDay ? currentDateKey : event.start}
                  >
                    {formatEventTime(event, currentDateKey, agenda.timeZone)}
                  </time>
                  <div className="today-event-details">
                    <h2>{event.title}</h2>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {agenda.failedSourceCount > 0 && !hasNoAvailableSources ? (
          <p className="today-schedule-note" role="status">
            Some calendar sources could not be checked during the latest update.
          </p>
        ) : null}
      </section>
    </>
  );
}
