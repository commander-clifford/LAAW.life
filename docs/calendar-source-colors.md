# Calendar source colors

This change adds small calendar-color dots to Day Card titles and search results.
Calendar membership, event dates, all-day handling, recurrence and carousel behavior
are unchanged. The October 12, 2026 holiday was already present in Hawthorne;
the initially compared Ivy and Hawthorne screenshots represented different sources.

## Source evidence

On October 12, 2026, the current live Hawthorne full-calendar embed used the same
eight `src` values and eight `color` values as `src/config/laaw-life.ts`.
Its rendered dots confirmed these mappings:

| Calendar source | Current configured and rendered color |
| --- | --- |
| Hawthorne venue calendar | `#D81B60` |
| Los Angeles Football Club | `#616161` |
| Los Angeles Galaxy | `#E67C73` |
| Holidays in United States | `#0B8043` |

The remaining configured source colors are Chargers `#F4511E`, Rams `#B39DDB`,
UCLA `#B39DDB` and USC `#B39DDB`. Their public feeds had no events in this audit,
so there were no rendered events from those sources to compare. No color is inferred
from event titles, categories or descriptions.

Ivy's original embed relied on Google's display defaults instead of explicit
`color` parameters. Reading its visible calendar picker on October 12, 2026
confirmed `#7986CB` for all eight exact configured calendar IDs: Culver City venue,
Chargers, LAFC, Galaxy, Kings, Rams, UCLA and USC. The current and legacy Ivy event
dots independently confirmed that blue for the venue, LAFC and Galaxy. The config
now records those existing colors explicitly. Venue, food and trivia entries from
the same Ivy source share the same blue; the source membership remains unchanged.

The legacy `/og/` Hawthorne embed includes a retired source and a different color
mapping. Its lavender holiday dot is not the color of the current modern embed.
This change preserves the current configuration rather than copying that legacy
palette.

The fill retains the exact source color. A thin neutral border keeps dark source
colors visible against the site's dark surfaces. The border sits inside a 10px
marker box, preserving the 8px color fill and avoiding clipping by event windows.

## Import and accessibility

The parser retains explicit six-digit hex colors only when repeated source and
color parameters provide a complete positional mapping. Invalid colors and
conflicting duplicate-source colors are omitted. Each normalized event receives
an optional `sourceColor` from its configured calendar, including recurring and
all-day events. Remote snapshots validate the optional color and remain compatible
with older snapshots without it. New events preserve `sourceCalendarId` from the
configured feed identity. At the common display boundary, absent colors are filled
from the trusted location registry using that exact ID; older snapshots use a
unique `calendarId:` prefix in their existing event IDs. This keeps colors on cards,
search and the key even when a newer snapshot from an older generator lacks color
metadata. Source names and event categories never determine the color.

The inspected public Google ICS feeds contained no calendar or event color
properties. ICS can carry optional color metadata under
[RFC 7986](https://datatracker.ietf.org/doc/html/rfc7986#section-5.9); this change
does not claim to recover event-specific overrides absent from these feeds.
Google documents account-specific calendar colors in
[CalendarList](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList)
and event colors separately in
[Events](https://developers.google.com/workspace/calendar/api/v3/reference/events)
and the [Colors palettes](https://developers.google.com/workspace/calendar/api/v3/reference/colors).

Dots are decorative and hidden from assistive technology. Day Card rows expose
“Calendar: [source name]” as screen-reader text; search results retain their visible
source names. A compact “Calendar colors” disclosure below the carousel shows
the source names alongside their dots and opens with a click or keyboard activation.
Dots are hidden in forced-color mode; labels remain available. The indicator does
not encode an event category or replace text.

## Verification

Light mode now paints the page, body, canvas and header pure white. Muted heading
and selected-control surfaces remain neutral; the explicit and system dark-theme
token values are preserved. Both location routes are checked in explicit and system
light mode at mobile and desktop sizes, including navigation, focus and source colors.

Focused unit checks cover source/color pairing, invalid and incomplete mappings,
duplicate-source conflicts, optional snapshot validation, and colored/uncolored
rendering. Browser checks use deterministic events with the real configured source
colors at 320px and 1280px in light and dark modes. They verify title wrapping,
source names, all-day labels, day navigation, keyboard access to the source key,
search results and forced colors, with automated WCAG A/AA scans. The local preview uses actual public feed
events and preserves the current calendar membership.

Prepared code and preview require review before merge or production publication.

The requested local `dev` branch starts at verified GitHub `main` commit
`e9fa63148fe61ee08b3ac092ffc60ffcca233cb4`. The development preview runs at
`http://127.0.0.1:4205/hawthorne/`.
Ivy runs at `http://127.0.0.1:4205/ivy/` on the same local development server.
