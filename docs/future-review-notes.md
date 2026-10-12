# LAAW.life future review notes

Cliff requested these future items on October 12, 2026. All are explicitly non-blockers for the current release and must not delay production.

## Event catalog fast follow

Cliff grouped the event catalog foundation and event-based themes into one fast follow after the current release. Preserve their existing work in `codex/issue-7-event-catalog` / [draft PR 21](https://github.com/commander-clifford/LAAW.life/pull/21) and `codex/issue-3-event-aware-today` / [draft PR 23](https://github.com/commander-clifford/LAAW.life/pull/23). The current release omits catalog generation, metadata enrichment, event-theme selection/styling and catalog review/admin surfaces. Approved search uses regular calendar events directly. The full admin editor and hosted catalog remain future work. No scheduled automation was requested.

## Search suggestion cards

Suggested search results should have little cards. Keep this presentation idea separate from the navigation and focus review; implementation is future work.

## Mobile navigation and keyboard focus

Track this combined review in [GitHub issue 24](https://github.com/commander-clifford/LAAW.life/issues/24).

Review the mobile usability of the left and right Day Card arrows and dot buttons, keyboard Tab navigation through buttons and controls, and focus behavior. Visible focus already exists. Exact refinements remain to be clarified with Cliff; this is a review request rather than a diagnosis of defects or a prescribed redesign.

## Keeping formatted dates together

Track this separate request in [GitHub issue 25](https://github.com/commander-clifford/LAAW.life/issues/25).

Automate non-breaking spaces between the parts of formatted dates, such as `June 22, 2019`, so each complete date stays together when surrounding text wraps. This is future work; no non-breaking-space logic is part of the immediate search presentation change.

## Common card attributes

Future thought: establish a common card with reusable attributes. Review which attributes are useful before expanding the existing Card component; no broader component refactor is part of the current search styling change.

## Down arrow for more Day Card items

Track this separate request in [GitHub issue 26](https://github.com/commander-clifford/LAAW.life/issues/26).

When Day Card event/items content exceeds its visible scroll area and more items remain below, show a small down arrow at the bottom as a cue that more content can be scrolled into view. Appearance, placement and behavior remain for later review. This is a future note, not an implementation in the current release.

## All day events in the header

Track this distinct future request in [GitHub issue 27](https://github.com/commander-clifford/LAAW.life/issues/27).

Move events labeled all-day out of the regular itemized/timed list and give them greater prominence in the Day Card header. All-day events should help set the style or mood of that day's card. The header design has not been chosen, and handling multiple all-day events remains an open design question. This is exploratory, non-blocking future work with no immediate code or preview change.

Example from Cliff's dark mobile Ivy Station preview: Wednesday, October 21, 2026 lists `$10 Flight Night` as `All day` above `Thrift Store Bingo w/ @DJSundy1977` at `6:30–8:30 PM`. The proposed hierarchy would give Flight Night prominence in the header while leaving the timed bingo entry in the regular list; the header layout remains undecided.

## Event row containers and spacing

Track this separate future request in [GitHub issue 28](https://github.com/commander-clifford/LAAW.life/issues/28).

In the same screenshot, `Thrift Store Bingo w/ @DJSundy1977` appears beside `6:30–8:30 PM`. The prefix `Thrift Store Bingo w/ @DJSun`, counted from the initial T through n, contains 28 literal characters including spaces and punctuation. About `28ch` was a provisional trial measure; ch measures glyph 0 rather than literal character count, and no fixed width is approved.

Cliff refined the approach for the next round: each event list item should have two child containers, one for the title and one for the time, with those blocks governing padding and spacing. The title should flex and wrap naturally while the time remains clear and stable. Preserve full names, accessible semantics and existing all-day labels. Let the handle naturally wrap as a word where appropriate. This remains future, non-blocking implementation guidance for issue 28; the earlier 28ch idea must not be imposed blindly. The all-day header idea remains separate.

Local screenshot reference: [Original screenshot](/Users/cliffordnelson/.codex/visualizations/2026/10/02/01a0fbdd-8456-70d0-b9a4-a798bfaf13fd/issue-28-event-title-before.png). The concrete example is recorded in the GitHub issue; an issue-attachment upload is not available through the connected GitHub tools.

## Search usability after V1

Track this future review in [GitHub issue 29](https://github.com/commander-clifford/LAAW.life/issues/29).

Evaluate V1 search usability after it ships and identify appropriate improvements. Exact changes remain open. Consider the existing little-card idea for search results, and coordinate keyboard/focus findings with issue 24 rather than duplicating that work. Cliff approved the current reviewed V1 search for the combined release; this follow-up is explicitly non-blocking and must not delay it.
