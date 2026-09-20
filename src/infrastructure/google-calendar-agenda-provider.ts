import { Buffer } from "node:buffer";

import ical, {
  type CalendarResponse,
  type EventInstance,
  type ParameterValue,
} from "node-ical";
import { Temporal } from "temporal-polyfill";

import type {
  CalendarAgenda,
  CalendarAgendaItem,
  CalendarAgendaProvider,
} from "@/src/application/ports";
import type { CalendarSource } from "@/src/domain/site";
import { parseGoogleCalendarEmbed } from "@/src/infrastructure/google-calendar-source";

const feedRequestTimeoutMilliseconds = 10_000;
const maximumFeedBytes = 10_000_000;
const coverageDaysBeforeToday = 1;
const coverageDaysAfterToday = 35;

type ParsedCalendarFeed = Readonly<{
  calendarKey: string;
  data: CalendarResponse;
}>;

type CalendarAgendaFixture = Readonly<{
  body: string;
  calendarKey: string;
}>;

type BuildCalendarAgendaOptions = Readonly<{
  failedSourceCount?: number;
  feeds: readonly CalendarAgendaFixture[];
  now: Date;
  sourceCount?: number;
  timeZone: string;
}>;

const calendarFeedRequests = new Map<string, Promise<CalendarResponse>>();

function buildPublicCalendarFeedUrl(calendarId: string): string {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
}

async function fetchPublicCalendarFeed(
  calendarId: string,
): Promise<CalendarResponse> {
  const existingRequest = calendarFeedRequests.get(calendarId);

  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    const response = await fetch(buildPublicCalendarFeedUrl(calendarId), {
      headers: {
        Accept: "text/calendar",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(feedRequestTimeoutMilliseconds),
    });

    if (!response.ok) {
      throw new Error(`Calendar feed returned HTTP ${response.status}`);
    }

    const body = await response.text();

    if (
      Buffer.byteLength(body, "utf8") > maximumFeedBytes ||
      !body.includes("BEGIN:VCALENDAR")
    ) {
      throw new Error("Calendar feed returned an invalid iCalendar document");
    }

    return ical.async.parseICS(body);
  })();

  calendarFeedRequests.set(calendarId, request);
  return request;
}

function getParameterText(
  value: ParameterValue | undefined,
  fallback: string,
): string {
  const text = typeof value === "string" ? value : value?.val;
  const normalizedText = text?.trim();

  return normalizedText || fallback;
}

function getLocalDateOnly(date: Date): Temporal.PlainDate {
  return Temporal.PlainDate.from({
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  });
}

function getZonedDate(date: Date, timeZone: string): Temporal.PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime())
    .toZonedDateTimeISO(timeZone)
    .toPlainDate();
}

function getDateKeys(
  instance: EventInstance,
  coverageStart: Temporal.PlainDate,
  coverageEndExclusive: Temporal.PlainDate,
  timeZone: string,
): readonly string[] {
  const startDate = instance.isFullDay
    ? getLocalDateOnly(instance.start)
    : getZonedDate(instance.start, timeZone);
  const eventEndExclusive = instance.isFullDay
    ? getLocalDateOnly(instance.end)
    : getZonedDate(
        new Date(
          Math.max(instance.start.getTime(), instance.end.getTime() - 1),
        ),
        timeZone,
      ).add({ days: 1 });
  const lastDateExclusive = Temporal.PlainDate.compare(
    eventEndExclusive,
    startDate,
  ) > 0
    ? eventEndExclusive
    : startDate.add({ days: 1 });
  const clippedStart = Temporal.PlainDate.compare(startDate, coverageStart) < 0
    ? coverageStart
    : startDate;
  const clippedEnd = Temporal.PlainDate.compare(
    lastDateExclusive,
    coverageEndExclusive,
  ) > 0
    ? coverageEndExclusive
    : lastDateExclusive;
  const dateKeys: string[] = [];

  for (
    let date = clippedStart;
    Temporal.PlainDate.compare(date, clippedEnd) < 0;
    date = date.add({ days: 1 })
  ) {
    dateKeys.push(date.toString());
  }

  return dateKeys;
}

function buildCalendarAgenda(
  feeds: readonly ParsedCalendarFeed[],
  {
    failedSourceCount = 0,
    now,
    sourceCount = feeds.length + failedSourceCount,
    timeZone,
  }: Omit<BuildCalendarAgendaOptions, "feeds">,
): CalendarAgenda {
  const today = Temporal.Instant.fromEpochMilliseconds(now.getTime())
    .toZonedDateTimeISO(timeZone)
    .toPlainDate();
  const coverageStart = today.subtract({ days: coverageDaysBeforeToday });
  const coverageEndExclusive = today.add({
    days: coverageDaysAfterToday + 1,
  });
  const rangeStart = new Date(
    coverageStart.toZonedDateTime(timeZone).epochMilliseconds,
  );
  const rangeEnd = new Date(
    coverageEndExclusive.toZonedDateTime(timeZone).epochMilliseconds - 1,
  );
  const availableDateKeys: string[] = [];
  const agendaItems: CalendarAgendaItem[] = [];

  for (
    let date = coverageStart;
    Temporal.PlainDate.compare(date, coverageEndExclusive) < 0;
    date = date.add({ days: 1 })
  ) {
    availableDateKeys.push(date.toString());
  }

  for (const feed of feeds) {
    const sourceName =
      feed.data.vcalendar?.["WR-CALNAME"]?.trim() || "Calendar";

    for (const component of Object.values(feed.data)) {
      if (
        !component ||
        component.type !== "VEVENT" ||
        component.status === "CANCELLED" ||
        component.recurrenceid
      ) {
        continue;
      }

      const instances = ical.expandRecurringEvent(component, {
        expandOngoing: true,
        from: rangeStart,
        to: rangeEnd,
      });

      for (const instance of instances) {
        // node-ical applies overrides but does not omit CANCELLED instances.
        if (instance.event.status === "CANCELLED") {
          continue;
        }

        const dateKeys = getDateKeys(
          instance,
          coverageStart,
          coverageEndExclusive,
          timeZone,
        );

        if (dateKeys.length === 0) {
          continue;
        }

        agendaItems.push({
          allDay: instance.isFullDay,
          dateKeys,
          end: instance.end.toISOString(),
          id: `${feed.calendarKey}:${instance.event.uid}:${instance.start.toISOString()}`,
          location: instance.event.location
            ? getParameterText(instance.event.location, "") || null
            : null,
          sourceName,
          start: instance.start.toISOString(),
          title: getParameterText(instance.summary, "Untitled event"),
        });
      }
    }
  }

  agendaItems.sort((first, second) => {
    if (first.allDay !== second.allDay) {
      return first.allDay ? -1 : 1;
    }

    return (
      first.start.localeCompare(second.start) ||
      first.title.localeCompare(second.title)
    );
  });

  return {
    availableDateKeys,
    events: agendaItems,
    failedSourceCount,
    generatedAt: now.toISOString(),
    initialDateKey: today.toString(),
    sourceCount,
    timeZone,
  };
}

export function buildCalendarAgendaFromIcs({
  failedSourceCount = 0,
  feeds,
  now,
  sourceCount = feeds.length + failedSourceCount,
  timeZone,
}: BuildCalendarAgendaOptions): CalendarAgenda {
  const parsedFeeds = feeds.map(({ body, calendarKey }) => ({
    calendarKey,
    data: ical.sync.parseICS(body),
  }));

  return buildCalendarAgenda(parsedFeeds, {
    failedSourceCount,
    now,
    sourceCount,
    timeZone,
  });
}

export const googleCalendarAgendaProvider: CalendarAgendaProvider = {
  async getAgenda(source: CalendarSource) {
    if (source.provider !== "google-calendar-embed") {
      throw new Error(`Unsupported calendar provider: ${source.provider}`);
    }

    const { calendarIds, timeZone } = parseGoogleCalendarEmbed(source.src);
    const results = await Promise.allSettled(
      calendarIds.map(async (calendarId) => ({
        calendarKey: calendarId,
        data: await fetchPublicCalendarFeed(calendarId),
      })),
    );
    const parsedFeeds = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    const failedSourceCount = results.length - parsedFeeds.length;

    if (failedSourceCount > 0) {
      console.warn(
        `Day Card schedule could not load ${failedSourceCount} of ${results.length} public calendar feeds.`,
      );
    }

    return buildCalendarAgenda(parsedFeeds, {
      failedSourceCount,
      now: new Date(),
      sourceCount: results.length,
      timeZone,
    });
  },
};
