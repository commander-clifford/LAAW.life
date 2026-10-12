import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalendarAgendaItem } from "@/src/application/ports";
import { CalendarSourceLegend } from "@/src/components/calendar-source-legend";

function event(sourceName: string, sourceColor?: string): CalendarAgendaItem {
  return {
    allDay: true,
    dateKeys: ["2026-10-12"],
    end: "2026-10-13T00:00:00.000Z",
    id: `${sourceName}-${sourceColor}`,
    location: null,
    sourceColor,
    sourceName,
    start: "2026-10-12T00:00:00.000Z",
    title: "Calendar event",
  };
}

describe("CalendarSourceLegend", () => {
  it("starts collapsed and deduplicates actual calendar name/color pairs", () => {
    const html = renderToStaticMarkup(
      <CalendarSourceLegend events={[
        event("Hawthorne Calendar", "#D81B60"),
        event("Hawthorne Calendar", "#d81b60"),
        event("Hawthorne Calendar", "#616161"),
        event("US holidays", "#0B8043"),
        event("Uncolored calendar"),
        event("Invalid color", "lavender"),
      ]} />,
    );

    expect(html).toContain('data-calendar-source-legend=""');
    expect(html).toContain(">Calendar colors</summary>");
    expect(html).not.toContain(" open");
    expect(html.match(/<li\b/g)).toHaveLength(3);
    expect(html.match(/Hawthorne Calendar/g)).toHaveLength(2);
    expect(html).toContain("US holidays");
    expect(html.match(/background-color:#D81B60/g)).toHaveLength(1);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(3);
    expect(html).not.toContain("Uncolored calendar");
    expect(html).not.toContain("Invalid color");
  });

  it("omits the disclosure when no named calendar has a valid source color", () => {
    expect(renderToStaticMarkup(<CalendarSourceLegend events={[]} />)).toBe("");
    expect(renderToStaticMarkup(
      <CalendarSourceLegend events={[
        event("Ivy Station"),
        event("Short hex", "#abc"),
        event(" ", "#D81B60"),
      ]} />,
    )).toBe("");
  });
});
