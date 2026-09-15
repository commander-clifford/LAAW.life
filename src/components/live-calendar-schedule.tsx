"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { getNewerCalendarAgenda } from "@/src/application/calendar-agenda";
import type { CalendarAgenda } from "@/src/application/ports";
import { TodaySchedule } from "@/src/components/today-schedule";

const refreshIntervalMilliseconds = 5 * 60_000;
const staleAfterMilliseconds = 48 * 60 * 60_000;
const agendaUrl = process.env.NEXT_PUBLIC_CALENDAR_AGENDA_URL ||
  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/calendar-data/agendas.json`;

function subscribeToClock(notify: () => void): () => void {
  const interval = window.setInterval(notify, 60_000);
  window.addEventListener("focus", notify);
  document.addEventListener("visibilitychange", notify);
  return () => {
    window.clearInterval(interval);
    window.removeEventListener("focus", notify);
    document.removeEventListener("visibilitychange", notify);
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
}>;

export function LiveCalendarSchedule({ agenda, locationId }: LiveCalendarScheduleProps) {
  const [refreshed, setRefreshed] = useState<{
    agenda: CalendarAgenda;
    locationId: string;
  } | null>(null);
  const currentAgenda = refreshed?.locationId === locationId &&
    Date.parse(refreshed.agenda.generatedAt) > Date.parse(agenda.generatedAt)
    ? refreshed.agenda
    : agenda;
  const currentMinute = useSyncExternalStore(subscribeToClock, getCurrentMinute, getServerMinute);

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
    <TodaySchedule agenda={currentAgenda}>
      {isStale ? (
        <p className="today-schedule-note" role="status">
          Calendar updates are delayed. Check the full calendar below for the latest events.
        </p>
      ) : null}
    </TodaySchedule>
  );
}
