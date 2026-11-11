import type { CalendarAgendaItem } from "@/src/application/ports";

type CalendarSourceStyle = Pick<CalendarAgendaItem, "sourceColor" | "sourceName">;

function semanticName(name: string): string {
  return name.normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64).replace(/-+$/g, "") || "calendar";
}

export function getCalendarLocationClassName(locationId: string): string {
  return `calendar-location--${semanticName(locationId)}`;
}

export function getCalendarSourceClassName(source: CalendarSourceStyle): string | undefined {
  if (!source.sourceColor || !/^#[0-9a-f]{6}$/i.test(source.sourceColor)) return undefined;
  return `calendar-source--${semanticName(source.sourceName)}`;
}

export function getCalendarSourceStyles(sources: readonly CalendarSourceStyle[], locationId: string): string {
  const rules = new Set<string>();
  const locationClass = getCalendarLocationClassName(locationId);
  for (const source of sources) {
    const className = getCalendarSourceClassName(source);
    if (className && source.sourceColor) {
      // Shared calendars can have different configured colors at each location.
      rules.add(`.${locationClass} .${className} { --calendar-source-color: ${source.sourceColor.toUpperCase()}; }`);
    }
  }
  return [...rules].join("\n");
}
