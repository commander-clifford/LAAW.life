"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getDateKey } from "@/src/application/calendar-dates";
import type { CalendarAgenda, CalendarAgendaItem } from "@/src/application/ports";
import { Card } from "@/src/components/card";

type DayCardProps = Readonly<{
  agenda: CalendarAgenda;
  dateKey: string;
  index: number;
  isActive: boolean;
  relativeLabel: string;
}>;

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

type TimeParts = Readonly<{
  clock: string;
  dayPeriod: string | null;
  offset: string;
  zone: string;
}>;

type EventTimePresentation = Readonly<{
  accessibleText: string;
  compact: boolean;
  text: string;
}>;

type ScheduleScrollState = Readonly<{
  atEnd: boolean;
  atStart: boolean;
  overflows: boolean;
}>;

function getPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string | null {
  return parts.find((part) => part.type === type)?.value ?? null;
}

function getTimeParts(date: Date, timeZone: string): TimeParts {
  const clockParts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).formatToParts(date);
  const minute = getPart(clockParts, "minute") ?? "00";
  const hour = getPart(clockParts, "hour") ?? "";
  const zoneParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(date);
  const offsetParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(date);

  return {
    clock: `${hour}:${minute}`,
    dayPeriod: getPart(clockParts, "dayPeriod"),
    offset: getPart(offsetParts, "timeZoneName") ?? "",
    zone: getPart(zoneParts, "timeZoneName") ?? "",
  };
}

function joinTimeParts({ clock, dayPeriod }: TimeParts): string {
  return dayPeriod === null ? clock : `${clock} ${dayPeriod}`;
}

function formatTime(date: Date, timeZone: string): string {
  return joinTimeParts(getTimeParts(date, timeZone));
}

function formatTimeRange(
  start: Date,
  end: Date,
  timeZone: string,
): EventTimePresentation {
  const startParts = getTimeParts(start, timeZone);
  const endParts = getTimeParts(end, timeZone);
  const startTime = joinTimeParts(startParts);
  const endTime = joinTimeParts(endParts);

  if (start.getTime() === end.getTime()) {
    return {
      accessibleText: startTime,
      compact: true,
      text: startTime,
    };
  }

  if (startParts.offset !== endParts.offset) {
    const zonedStart = `${startTime} ${startParts.zone}`;
    const zonedEnd = `${endTime} ${endParts.zone}`;
    return {
      accessibleText: `${zonedStart} to ${zonedEnd}`,
      compact: false,
      text: `${zonedStart}–${zonedEnd}`,
    };
  }

  if (
    startParts.dayPeriod !== null &&
    startParts.dayPeriod === endParts.dayPeriod
  ) {
    return {
      accessibleText: `${startTime} to ${endTime}`,
      compact: true,
      text: `${startParts.clock}–${endParts.clock} ${endParts.dayPeriod}`,
    };
  }

  return {
    accessibleText: `${startTime} to ${endTime}`,
    compact: true,
    text: `${startTime}–${endTime}`,
  };
}

function formatEventTime(
  event: CalendarAgendaItem,
  dateKey: string,
  timeZone: string,
): EventTimePresentation {
  if (event.allDay) {
    return { accessibleText: "All day", compact: true, text: "All day" };
  }

  const start = new Date(event.start);
  const end = new Date(event.end);
  const startDateKey = getDateKey(start, timeZone);
  const endDateKey = getDateKey(
    new Date(Math.max(start.getTime(), end.getTime() - 1)),
    timeZone,
  );

  if (startDateKey < dateKey && endDateKey > dateKey) {
    return {
      accessibleText: "Continues all day",
      compact: true,
      text: "Continues all day",
    };
  }

  if (startDateKey < dateKey) {
    const time = formatTime(end, timeZone);
    return {
      accessibleText: `Until ${time}`,
      compact: true,
      text: `Until ${time}`,
    };
  }

  if (endDateKey > dateKey) {
    const time = formatTime(start, timeZone);
    return {
      accessibleText: `From ${time}`,
      compact: true,
      text: `From ${time}`,
    };
  }

  return formatTimeRange(start, end, timeZone);
}

function getUnavailableMessage(index: number): string {
  if (index === 0) {
    return "Today's schedule is unavailable.";
  }

  return "This day's schedule is unavailable.";
}

function getEmptyMessage(index: number): string {
  if (index === 0) {
    return "Nothing is scheduled for today.";
  }

  if (index === 1) {
    return "Nothing is scheduled for tomorrow.";
  }

  return "Nothing is scheduled for this day.";
}

export function DayCard({
  agenda,
  dateKey,
  index,
  isActive,
  relativeLabel,
}: DayCardProps) {
  const scheduleRef = useRef<HTMLElement>(null);
  const eventListRef = useRef<HTMLOListElement>(null);
  const [scheduleScrollState, setScheduleScrollState] = useState<ScheduleScrollState>({
    atEnd: true,
    atStart: true,
    overflows: false,
  });
  const formattedDate = formatDate(dateKey);
  const headingId = `day-card-heading-${dateKey}`;
  const eventsId = `day-card-events-${dateKey}`;
  const scrollInstructionsId = `${eventsId}-scroll-instructions`;
  const isDateAvailable = agenda.availableDateKeys.includes(dateKey);
  const hasNoAvailableSources =
    agenda.sourceCount > 0 &&
    agenda.failedSourceCount === agenda.sourceCount;
  const events = agenda.events.filter((event) =>
    event.dateKeys.includes(dateKey),
  );

  const measureSchedule = useCallback(() => {
    const schedule = scheduleRef.current;
    if (!schedule) return;

    const maximumScrollTop = Math.max(
      schedule.scrollHeight - schedule.clientHeight,
      0,
    );
    const nextState: ScheduleScrollState = {
      atEnd: maximumScrollTop <= 1 ||
        schedule.scrollTop >= maximumScrollTop - 1,
      atStart: schedule.scrollTop <= 1,
      overflows: maximumScrollTop > 1,
    };
    setScheduleScrollState((current) =>
      current.atEnd === nextState.atEnd &&
        current.atStart === nextState.atStart &&
        current.overflows === nextState.overflows
        ? current
        : nextState
    );
  }, []);

  useEffect(() => {
    const schedule = scheduleRef.current;
    const eventList = eventListRef.current;
    if (!schedule) return;

    measureSchedule();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measureSchedule);
    observer.observe(schedule);
    if (eventList) observer.observe(eventList);

    return () => observer.disconnect();
  }, [agenda.generatedAt, dateKey, events.length, measureSchedule]);

  return (
    <Card
      className="day-card"
      data-active={isActive}
      data-day-card=""
      data-day-index={index}
      id={`day-card-${dateKey}`}
      role="group"
      aria-labelledby={headingId}
      aria-roledescription="slide"
    >
      <header className="day-card-heading">
        <h2 className="day-card-date" id={headingId}>
          <time
            dateTime={dateKey}
            aria-label={`${relativeLabel}, ${formattedDate.weekday}, ${formattedDate.calendarDate}`}
          >
            <span className="day-card-weekday">{formattedDate.weekday}</span>{" "}
            <span className="day-card-calendar-date">
              {formattedDate.calendarDate}
            </span>
          </time>
        </h2>
        <span className="day-card-relative-label" aria-hidden="true">
          {relativeLabel}
        </span>
      </header>
      <div
        className="day-card-schedule-frame"
        data-at-end={scheduleScrollState.atEnd}
        data-at-start={scheduleScrollState.atStart}
        data-overflow={scheduleScrollState.overflows}
      >
        <section
          className="day-card-schedule"
          id={eventsId}
          aria-label={`${relativeLabel} events`}
          aria-describedby={
            scheduleScrollState.overflows ? scrollInstructionsId : undefined
          }
          data-overflow={scheduleScrollState.overflows}
          onScroll={measureSchedule}
          ref={scheduleRef}
          tabIndex={scheduleScrollState.overflows ? 0 : undefined}
        >
          {!isDateAvailable || hasNoAvailableSources ? (
            <p className="day-card-message">{getUnavailableMessage(index)}</p>
          ) : events.length === 0 ? (
            <p className="day-card-message">{getEmptyMessage(index)}</p>
          ) : (
            <ol className="day-card-event-list" ref={eventListRef}>
              {events.map((event) => {
                const eventTime = formatEventTime(
                  event,
                  dateKey,
                  agenda.timeZone,
                );

                return (
                  <li className="day-card-event" key={event.id}>
                    <time
                      className="day-card-event-time"
                      dateTime={event.allDay ? dateKey : event.start}
                      aria-label={eventTime.accessibleText}
                      data-compact={eventTime.compact}
                    >
                      {eventTime.text}
                    </time>
                    <h3>{event.title}</h3>
                  </li>
                );
              })}
            </ol>
          )}
          {scheduleScrollState.overflows ? (
            <p className="visually-hidden" id={scrollInstructionsId}>
              Scroll vertically to view more events.
            </p>
          ) : null}
        </section>
        <span
          className="day-card-schedule-fade day-card-schedule-fade-top"
          aria-hidden="true"
        />
        <span
          className="day-card-schedule-fade day-card-schedule-fade-bottom"
          aria-hidden="true"
        />
      </div>
    </Card>
  );
}
