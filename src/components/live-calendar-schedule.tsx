"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { getNewerCalendarAgenda } from "@/src/application/calendar-agenda";
import { getDateKey } from "@/src/application/calendar-dates";
import type { CalendarAgenda } from "@/src/application/ports";
import {
  DayCardCarousel,
  type TodayControlMotion,
} from "@/src/components/day-card-carousel";

const refreshIntervalMilliseconds = 5 * 60_000;
const staleAfterMilliseconds = 48 * 60 * 60_000;
const todayControlEnableProgress = 0.2;
const todayControlDisableProgress = 0.1;
const todayControlMinimumOffstageGapPixels = 20;
const todayControlMaximumOffstageGapPixels = 32;
const todayControlOffstageGapRatio = 0.03;
const agendaUrl = process.env.NEXT_PUBLIC_CALENDAR_AGENDA_URL ||
  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/calendar-data/agendas.json`;

function subscribeToClock(notify: () => void): () => void {
  let timer: number;
  const scheduleNextMinute = () => {
    window.clearTimeout(timer);
    const millisecondsUntilNextMinute = 60_000 - Date.now() % 60_000;
    timer = window.setTimeout(() => {
      notify();
      scheduleNextMinute();
    }, millisecondsUntilNextMinute);
  };
  const refreshAndReschedule = () => {
    notify();
    scheduleNextMinute();
  };

  scheduleNextMinute();
  window.addEventListener("focus", refreshAndReschedule);
  document.addEventListener("visibilitychange", refreshAndReschedule);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener("focus", refreshAndReschedule);
    document.removeEventListener("visibilitychange", refreshAndReschedule);
  };
}

function getCurrentMinute(): number {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

function getServerMinute(): null {
  return null;
}

type LiveCalendarScheduleProps = Readonly<{
  agenda: CalendarAgenda;
  locationId: string;
  locationName: string;
}>;

function formatTodayDate(dateKey: string): Readonly<{
  calendarDate: string;
  fullDate: string;
  weekday: string;
}> {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
  }).format(date);
  const calendarDate = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);

  return {
    calendarDate,
    fullDate: `${weekday}, ${calendarDate}`,
    weekday,
  };
}

export function LiveCalendarSchedule({
  agenda,
  locationId,
  locationName,
}: LiveCalendarScheduleProps) {
  const [refreshed, setRefreshed] = useState<{
    agenda: CalendarAgenda;
    locationId: string;
  } | null>(null);
  const [returnToTodayRequest, setReturnToTodayRequest] = useState(0);
  const [todayControlIsInteractive, setTodayControlIsInteractive] = useState(
    false,
  );
  const todayControlIsInteractiveRef = useRef(false);
  const todayControlRef = useRef<HTMLButtonElement>(null);
  const currentAgenda = refreshed?.locationId === locationId &&
    Date.parse(refreshed.agenda.generatedAt) > Date.parse(agenda.generatedAt)
    ? refreshed.agenda
    : agenda;
  const currentMinute = useSyncExternalStore(subscribeToClock, getCurrentMinute, getServerMinute);
  const currentDateKey = currentMinute === null
    ? null
    : getDateKey(new Date(currentMinute), currentAgenda.timeZone);
  const todayDate = currentDateKey === null
    ? null
    : formatTodayDate(currentDateKey);

  const updateTodayControlMotion = useCallback(({
    direction,
    progress,
  }: TodayControlMotion) => {
    const control = todayControlRef.current;
    if (control) {
      const date = control.querySelector<HTMLElement>("time");
      const controlRect = control.getBoundingClientRect();
      const dateWidth = date?.offsetWidth ?? controlRect.width;
      const restingDateLeft = controlRect.right - dateWidth;
      const stageRight = controlRect.right;
      const offstageGap = Math.min(
        Math.max(
          controlRect.width * todayControlOffstageGapRatio,
          todayControlMinimumOffstageGapPixels,
        ),
        todayControlMaximumOffstageGapPixels,
      );
      const travel = Math.max(
        stageRight + offstageGap - restingDateLeft,
        0,
      );
      const translation = (1 - progress) * travel;
      control.style.setProperty(
        "--today-control-progress",
        String(progress),
      );
      control.style.setProperty(
        "--today-control-translation",
        `${translation}px`,
      );
      control.dataset.scrollDirection = direction;
      control.dataset.scrollProgress = progress.toFixed(4);
      control.dataset.scrollStageRight = stageRight.toFixed(4);
      control.dataset.scrollTravel = travel.toFixed(4);
    }

    const wasInteractive = todayControlIsInteractiveRef.current;
    const isInteractive = wasInteractive
      ? progress > todayControlDisableProgress
      : progress >= todayControlEnableProgress;
    if (isInteractive === wasInteractive) return;

    if (
      !isInteractive &&
      control !== null &&
      document.activeElement === control
    ) {
      document.getElementById("day-card-carousel-viewport")?.focus({
        preventScroll: true,
      });
    }
    todayControlIsInteractiveRef.current = isInteractive;
    setTodayControlIsInteractive(isInteractive);
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let controller: AbortController | undefined;

    const refresh = async () => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 10_000);
      try {
        const response = await fetch(agendaUrl, {
          cache: "no-store",
          credentials: "omit",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (!active) return;
        setRefreshed((previous) => {
          const current = previous?.locationId === locationId &&
            Date.parse(previous.agenda.generatedAt) > Date.parse(agenda.generatedAt)
            ? previous.agenda
            : agenda;
          const next = getNewerCalendarAgenda(payload, locationId, current, Date.now());
          return next === current ? previous : { agenda: next, locationId };
        });
      } catch {
        // Keep the bundled or last successful agenda during network failures.
      } finally {
        window.clearTimeout(timeout);
        inFlight = false;
      }
    };

    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, refreshIntervalMilliseconds);
    const resume = () => { void refresh(); };
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [agenda, locationId]);

  const isStale = currentMinute !== null &&
    (!Number.isFinite(Date.parse(currentAgenda.generatedAt)) ||
      currentMinute - Date.parse(currentAgenda.generatedAt) >= staleAfterMilliseconds);

  return (
    <>
      <header className="location-heading-section">
        <h1 className="location-page-heading">{locationName}</h1>
        {currentDateKey === null || todayDate === null ? (
          <span className="location-today-placeholder" aria-hidden="true" />
        ) : (
          <button
            className="location-today-control"
            type="button"
            aria-hidden={!todayControlIsInteractive}
            aria-controls="day-card-carousel-viewport"
            aria-label={`Return to Today, ${todayDate.fullDate}`}
            disabled={!todayControlIsInteractive}
            ref={todayControlRef}
            tabIndex={todayControlIsInteractive ? 0 : -1}
            onClick={() => setReturnToTodayRequest((request) => request + 1)}
          >
            <time dateTime={currentDateKey}>
              <span className="location-today-weekday">
                {todayDate.weekday},
              </span>{" "}
              <span className="location-today-calendar-date">
                {todayDate.calendarDate}
              </span>
            </time>
          </button>
        )}
      </header>
      <div className="day-card-section">
        <DayCardCarousel
          agenda={currentAgenda}
          currentDateKey={currentDateKey}
          locationId={locationId}
          onTodayControlMotion={updateTodayControlMotion}
          returnToTodayRequest={returnToTodayRequest}
        >
          {isStale ? (
            <p className="day-carousel-note" role="status">
              Calendar updates are delayed. Check the full calendar below for the latest events.
            </p>
          ) : null}
        </DayCardCarousel>
      </div>
    </>
  );
}
