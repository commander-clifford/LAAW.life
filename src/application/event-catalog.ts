import type { CalendarAgenda, CalendarAgendaItem, EventMetadata } from "@/src/application/ports";

type MetadataConfig = Readonly<{
  tagAliases: Record<string, string>;
  eventOverrides: Record<string, EventMetadata>;
  titleRules: Record<string, EventMetadata>;
}>;
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function normalized(value: string) { return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " "); }

export function eventCatalogKey(event: CalendarAgendaItem): string {
  // Feed identity + original UID survive title edits and recurring instances.
  return event.id.replace(/:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "");
}
export function validateEventMetadata(value: unknown, aliases: Record<string, string> = {}): EventMetadata {
  if (!record(value)) throw new Error("Event metadata must be an object");
  const displayName = value.displayName;
  if (displayName !== undefined && (typeof displayName !== "string" || !displayName.trim())) throw new Error("Display names must be nonempty text");
  const url = value.url;
  if (url !== undefined) {
    if (typeof url !== "string") throw new Error("Event links must be HTTPS or HTTP URLs");
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("Event links must be HTTPS or HTTP URLs without embedded credentials");
  }
  if (value.tags !== undefined && (!Array.isArray(value.tags) || !value.tags.every(tag => typeof tag === "string" && tag.trim()))) throw new Error("Tags must be nonempty text");
  const tags = [...new Set(((value.tags ?? []) as string[]).map(tag => Object.hasOwn(aliases, normalized(tag)) ? aliases[normalized(tag)] : normalized(tag)))].sort();
  const takeover = value.takeover;
  if (takeover !== undefined && (!record(takeover) || typeof takeover.enabled !== "boolean" || !["trivia", "bingo"].includes(String(takeover.theme)) || !Number.isInteger(takeover.priority) || Number(takeover.priority) < 0 || Number(takeover.priority) > 1000)) throw new Error("Takeovers need eligibility, a supported theme and a priority from 0 to 1000");
  return { ...(displayName !== undefined ? { displayName: (displayName as string).trim() } : {}), ...(url !== undefined ? { url: url as string } : {}), tags,
    ...(takeover !== undefined ? { takeover: takeover as NonNullable<EventMetadata["takeover"]> } : {}) };
}
export function parseEventMetadataConfig(value: unknown): MetadataConfig {
  if (!record(value) || value.version !== 1 || !record(value.tagAliases) || !record(value.eventOverrides) || !record(value.titleRules)) throw new Error("Invalid event metadata configuration");
  const aliases: Record<string, string> = Object.create(null);
  for (const [key, target] of Object.entries(value.tagAliases)) {
    if (!key.trim() || typeof target !== "string" || !target.trim()) throw new Error("Tag aliases need nonempty source and target text");
    const source = normalized(key);
    if (Object.hasOwn(aliases, source) && aliases[source] !== normalized(target)) throw new Error("Conflicting normalized tag aliases");
    aliases[source] = normalized(target);
  }
  // One-level aliases must point at canonical tags, not another alias/cycle.
  for (const target of Object.values(aliases)) if (aliases[target] && aliases[target] !== target) throw new Error("Tag aliases must point directly at canonical tags");
  const overrides: Record<string, EventMetadata> = Object.create(null);
  for (const [key, metadata] of Object.entries(value.eventOverrides)) {
    if (!key.trim()) throw new Error("Event override keys must be nonempty");
    overrides[key] = validateEventMetadata(metadata, aliases);
  }
  const rules: Record<string, EventMetadata> = Object.create(null);
  for (const [title, metadata] of Object.entries(value.titleRules)) {
    const key = normalized(title);
    if (!key || rules[key]) throw new Error("Title rules must be unique after normalization");
    rules[key] = validateEventMetadata(metadata, aliases);
  }
  return { tagAliases: aliases, eventOverrides: overrides, titleRules: rules };
}

export function enrichCalendarAgendas(agendas: Record<string, CalendarAgenda>, input: unknown): Record<string, CalendarAgenda> {
  const config = parseEventMetadataConfig(input);
  return Object.fromEntries(Object.entries(agendas).map(([locationId, agenda]) => [locationId, { ...agenda,
    events: agenda.events.map(event => {
      const metadata = config.eventOverrides[eventCatalogKey(event)] ?? config.titleRules[normalized(event.title)];
      return metadata ? { ...event, title: metadata.displayName ?? event.title, metadata } : event;
    }),
  }]));
}

export function buildEventCatalog(agendas: Record<string, CalendarAgenda>, metadataInput: unknown) {
  const config = parseEventMetadataConfig(metadataInput);
  const entries = new Map<string, { key: string; titles: string[]; sourceNames: string[]; locations: string[]; metadata?: EventMetadata; occurrences: { id: string; locationId: string; start: string; end: string; dateKeys: readonly string[] }[] }>();
  for (const [locationId, agenda] of Object.entries(agendas)) for (const event of agenda.events) {
    const key = eventCatalogKey(event);
    const metadata = config.eventOverrides[key] ?? config.titleRules[normalized(event.title)];
    const entry = entries.get(key) ?? { key, titles: [], sourceNames: [], locations: [], occurrences: [], ...(metadata ? { metadata } : {}) };
    if (!entry.titles.includes(event.title)) entry.titles.push(event.title);
    if (!entry.sourceNames.includes(event.sourceName)) entry.sourceNames.push(event.sourceName);
    if (!entry.locations.includes(locationId)) entry.locations.push(locationId);
    entry.occurrences.push({ id: event.id, locationId, start: event.start, end: event.end, dateKeys: event.dateKeys });
    entries.set(key, entry);
  }
  return { version: 1, generatedAt: Object.values(agendas).map(a => a.generatedAt).sort().at(-1),
    coverage: Object.fromEntries(Object.entries(agendas).map(([id, agenda]) => [id, { firstDate: agenda.availableDateKeys[0], lastDate: agenda.availableDateKeys.at(-1), failedSourceCount: agenda.failedSourceCount }])),
    entries: [...entries.values()].sort((a, b) => a.key.localeCompare(b.key)).map(entry => ({ ...entry, occurrences: entry.occurrences.sort((a,b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id)) })),
  };
}
