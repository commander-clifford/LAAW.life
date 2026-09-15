"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";

import type {
  CalendarAgenda,
  CalendarAgendaItem,
} from "@/src/application/ports";
import { Card } from "@/src/components/card";

const clockCheckIntervalMilliseconds = 60_000;

// Static HTML cannot know the visitor's current date. Keep the server and
// hydration render identical, including avoiding runtime-specific Intl output.
function getServerDateKey(): null {
  return null;
}

type TodayScheduleProps = Readonly<{
  agenda: CalendarAgenda;
  children?: ReactNode;
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

function formatDate(dateKey: string): { weekday: string; calendarDate: string } {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return {
    weekday: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "UTC",
    }).format(date),
    calendarDate: new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(date),
  };
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
  children,
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
  const formattedDate = currentDateKey === null ? null : formatDate(currentDateKey);
  const dateLine = (
    <p
      className="today-schedule-date"
      aria-hidden={currentDateKey === null || undefined}
    >
      {currentDateKey === null || formattedDate === null ? null : (
        <time dateTime={currentDateKey} aria-label={`${formattedDate.weekday}, ${formattedDate.calendarDate}`}>
          <span className="today-schedule-weekday">{formattedDate.weekday}</span>{" "}
          <span className="today-schedule-calendar-date">{formattedDate.calendarDate}</span>
        </time>
      )}
    </p>
  );
  const isDateAvailable = currentDateKey !== null && agenda.availableDateKeys.includes(currentDateKey);
  const hasNoAvailableSources =
    agenda.sourceCount > 0 &&
    agenda.failedSourceCount === agenda.sourceCount;
  const events = agenda.events.filter((event) =>
    currentDateKey !== null && event.dateKeys.includes(currentDateKey),
  );

  return (
    <Card className="daily-information-card">
      <div className="daily-information-heading">
        {dateLine}
      </div>
      <section
        className="today-schedule"
        aria-label="Daily events"
        aria-busy={currentDateKey === null}
      >
        <div aria-live="polite">
          {currentDateKey === null ? (
            <p className="today-schedule-message" role="status">
              Loading today&apos;s schedule…
            </p>
          ) : !isDateAvailable || hasNoAvailableSources ? (
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
                  <h2>{event.title}</h2>
                  <time
                    className="today-event-time"
                    dateTime={event.allDay ? currentDateKey : event.start}
                  >
                    {formatEventTime(event, currentDateKey, agenda.timeZone)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </div>

        {currentDateKey !== null && agenda.failedSourceCount > 0 && !hasNoAvailableSources ? (
          <p className="today-schedule-note" role="status">
            Some calendar sources could not be checked during the latest update.
          </p>
        ) : null}
        {children}
      </section>
    </Card>
  );
}
