import { describe, expect, it } from "vitest";
import { buildEventCatalog, enrichCalendarAgendas, eventCatalogKey, parseEventMetadataConfig } from "./event-catalog";
import type { CalendarAgenda } from "./ports";
const empty = { version: 1, tagAliases: {}, eventOverrides: {}, titleRules: {} };
const event = { allDay: true, title: "MACHINE NAME", id: "feed:original-uid:2026-10-02T19:00:00.000Z", start: "2026-10-02T19:00:00.000Z", end: "2026-10-02T20:00:00.000Z", dateKeys: ["2026-10-02"], sourceName: "Public calendar", location: null };
const agenda: CalendarAgenda = { timeZone: "America/Los_Angeles", initialDateKey: "2026-10-02", availableDateKeys: ["2026-10-02", "2026-10-09"], generatedAt: "2026-10-02T18:00:00.000Z", sourceCount: 1, failedSourceCount: 0, events: [event, { ...event, title: "Renamed source event", id: "feed:original-uid:2026-10-09T19:00:00.000Z", start: "2026-10-09T19:00:00.000Z", dateKeys: ["2026-10-09"] }] };
describe("event catalog", () => {
  it("groups recurring instances by source UID despite title changes and retains all occurrences", () => {
    expect(eventCatalogKey(event)).toBe("feed:original-uid");
    const catalog = buildEventCatalog({ ivy: agenda }, empty);
    expect(catalog.entries).toHaveLength(1);
    expect(catalog.entries[0].titles).toEqual(["MACHINE NAME", "Renamed source event"]);
    expect(catalog.entries[0].occurrences).toHaveLength(2);
  });
  it("normalizes synonymous tags, applies source identity overrides and preserves independent metadata", () => {
    const metadata = { displayName: "Neighborhood trivia", url: "https://example.org/trivia", tags: [" TRIVIA ", "Trivia", "quiz"], takeover: { enabled: true, theme: "trivia", priority: 10 } };
    const config = { ...empty, tagAliases: { quiz: "trivia" }, eventOverrides: { "feed:original-uid": metadata } };
    const enriched = enrichCalendarAgendas({ ivy: agenda }, config);
    expect(enriched.ivy.events.map(event => event.title)).toEqual(["Neighborhood trivia", "Neighborhood trivia"]);
    expect(enriched.ivy.events[0].metadata?.tags).toEqual(["trivia"]);
    expect(agenda.events[0].title).toBe("MACHINE NAME");
  });
  it("treats prototype-like calendar titles and tags as ordinary data", () => {
    const source = { ...agenda, events: [{ ...event, title: "constructor" }] };
    expect(enrichCalendarAgendas({ ivy: source }, empty).ivy.events[0].metadata).toBeUndefined();
    const configured = { ...empty, titleRules: { constructor: { tags: ["__proto__", "constructor"] } } };
    expect(enrichCalendarAgendas({ ivy: source }, configured).ivy.events[0].metadata?.tags).toEqual(["__proto__", "constructor"]);
    expect(() => parseEventMetadataConfig({ ...empty, tagAliases: { Quiz: "trivia", " quiz ": "bingo" } })).toThrow();
  });
  it("supports exact normalized title aliases while rejecting invalid links and conflicting alias rules", () => {
    const config = { ...empty, titleRules: { "machine name": { tags: ["food truck"] } } };
    expect(enrichCalendarAgendas({ ivy: agenda }, config).ivy.events[0].metadata?.tags).toEqual(["food truck"]);
    expect(() => parseEventMetadataConfig({ ...empty, titleRules: { foo: { url: "javascript:alert(1)" } } })).toThrow();
    expect(() => parseEventMetadataConfig({ ...empty, tagAliases: { quiz: "trivia", trivia: "quiz" } })).toThrow();
    expect(() => parseEventMetadataConfig({ ...empty, titleRules: { Trivia: {}, " trivia ": {} } })).toThrow();
  });
});
