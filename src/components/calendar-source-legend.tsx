import type { CalendarAgendaItem } from "@/src/application/ports";
import styles from "./calendar-source-legend.module.css";

type CalendarSourceLegendProps = Readonly<{
  events: readonly CalendarAgendaItem[];
}>;

export function CalendarSourceLegend({ events }: CalendarSourceLegendProps) {
  const sources = new Map<string, { color: string; name: string }>();

  for (const event of events) {
    if (
      !event.sourceColor ||
      !/^#[0-9a-f]{6}$/i.test(event.sourceColor) ||
      event.sourceName.trim().length === 0
    ) continue;

    const color = event.sourceColor.toUpperCase();
    const key = JSON.stringify([event.sourceName, color]);
    sources.set(key, { color, name: event.sourceName });
  }

  if (sources.size === 0) return null;

  return (
    <details className={styles.legend} data-calendar-source-legend="">
      <summary className={styles.summary}>Calendar colors</summary>
      <ul className={styles.sources}>
        {[...sources].map(([key, source]) => (
          <li key={key}>
            <span
              aria-hidden="true"
              className={styles.sourceDot}
              style={{ backgroundColor: source.color }}
            />
            <span>{source.name}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
