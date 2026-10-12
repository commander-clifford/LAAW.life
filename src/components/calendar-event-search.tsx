"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { CalendarAgenda } from "@/src/application/ports";
import { searchCalendarEvents } from "@/src/application/calendar-search";
import styles from "./calendar-event-search.module.css";

function dateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00Z`));
}

export function CalendarEventSearch({ agenda }: Readonly<{ agenda: CalendarAgenda }>) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const id = useId();
  const results = searchCalendarEvents(agenda.events, query);
  const dates = useMemo(() => [...new Set([
    ...agenda.availableDateKeys,
    ...agenda.events.flatMap(event => event.dateKeys),
  ])].sort(), [agenda.availableDateKeys, agenda.events]);
  const searching = query.trim().length > 0;
  return (
    <section className={styles.search} aria-labelledby={`${id}-label`}>
      <label className="visually-hidden" id={`${id}-label`} htmlFor={id}>Search events</label>
      <div className={styles.field}>
        <Search className={styles.magnifier} aria-hidden="true" />
        <input id={id} ref={inputRef} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(50); }} placeholder="Search events" aria-describedby={`${id}-range`} />
        {searching ? <button className={styles.clear} type="button" aria-label="Clear search" onClick={() => { setQuery(""); setVisibleCount(50); inputRef.current?.focus(); }}><X aria-hidden="true" /></button> : null}
      </div>
      <p className={styles.coverageNote} id={`${id}-range`}>
        {dates.length > 0 ? `Search past and upcoming events from ${dateLabel(dates[0])} through ${dateLabel(dates[dates.length - 1])}.` : "Calendar events are unavailable."}
      </p>
      {agenda.failedSourceCount > 0 ? <p className={styles.note}>Some calendar sources are unavailable. Search results may be incomplete.</p> : null}
      <p role="status" aria-live="polite" className={searching ? undefined : "visually-hidden"}>{searching ? `${results.length} matching ${results.length === 1 ? "event" : "events"}.` : ""}</p>
      {searching && results.length === 0 ? <p>No events match “{query.trim()}”.</p> : null}
      {searching && results.length > 0 ? <p className="visually-hidden" id={`${id}-results-help`}>Scroll or use the arrow keys to view more matching events.</p> : null}
      {searching && results.length > 0 ? <ol className={styles.results} tabIndex={0} aria-label="Matching calendar events" aria-describedby={`${id}-results-help`}>{results.slice(0, visibleCount).map((event) => (
        <li key={event.id}>
          <h3>{event.title}</h3>
          <p><time dateTime={event.allDay ? event.dateKeys[0] : event.start}>{dateLabel(event.dateKeys[0])}{event.dateKeys.length > 1 ? `–${dateLabel(event.dateKeys[event.dateKeys.length - 1])}` : ""}{event.allDay ? " · All day" : ` · ${new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone: agenda.timeZone }).format(new Date(event.start))}`}</time></p>
          {event.location ? <p>{event.location}</p> : null}
          {event.description ? <details><summary>Event details</summary><p className={styles.details}>{event.description}</p></details> : null}
          <p className={styles.note}>{event.sourceName}</p>
        </li>
      ))}</ol> : null}
      {searching && results.length > visibleCount ? <button type="button" onClick={() => setVisibleCount(count => count + 50)}>Show more events ({results.length - visibleCount} remaining)</button> : null}
    </section>
  );
}
