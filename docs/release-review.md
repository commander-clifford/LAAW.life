# LAAW.life combined review candidate

Local branch: `codex/release-review-preview`. This candidate combines issue drafts for #3, #4, #5, #7, #8 and #11. Production publication, issue closure, hosting activation and merges are pending human approval.

Review hub: http://127.0.0.1:4199/

Ivy preview: http://127.0.0.1:4194/ivy/?eventLayout=title-first

Hawthorne preview: http://127.0.0.1:4194/hawthorne/?eventLayout=title-first

## Current scope

- #3: configured trivia/bingo Today themes; deterministic screenshots are test examples, not invented production events.
- #4: title/detail search across imported past and upcoming events. The standalone magnifier input fills its containing block. The information icon and popover are removed; their unchanged range text is centered below the field in small supporting type, with a 122ch maximum measure and responsive wrapping. Colors derive from the existing design tokens and meet small-text contrast. Existing chronological order remains, including historical results.
- #5: seven initial dated cards and a same-size transparent Card rendered as one native button. Its entire surface loads seven more dates. Full-week coverage, final-week selection, gestures and keyboard focus are checked.
- #6: food menu system deferred behind its traffic gate.
- #7: catalog and reviewed metadata foundation. Full admin editing remains unimplemented.
- #8: stable calendar loading/recovery states, retry and Google link. Google embed internals remain outside this audit.
- #10: proposed shared date float deferred; original animation retained and issue open.
- #11: title-first rows with right-aligned times approved. Comparison controls remain preview-only.
- #12: hosting comparison/workflow prepared but inactive; account setup and activation require review.

## Verification

October 12 search presentation update: lint and type checks pass, all 82 unit tests pass, and static export verifies 41 files. All 17 focused Chromium checks pass across the existing search, combined-preview and presentation suites. They cover full-width input alignment, persistent accessible range descriptions, responsive wrapping, input/clear interactions, keyboard and touch, loading weeks, event themes and calendar recovery. Eight scoped axe scans report zero violations. Measured supporting-text contrast is 4.61:1 in light and 4.80:1 in dark at both tested widths, exceeding 4.5:1 for small text.

The October 9 core review covered 92 distinct browser checks and 64 clean axe scans for carousel, dates, focus, gestures, layout and controlled calendar states. Those earlier results are historical; the latest change is confined to search presentation.

Human review still includes actual screen-reader listening, spoken time descriptions and the cross-origin Google Calendar content. No new investigation or changes to time-label details are planned before human review. No production deployment, merge, push, issue closure or hosting activation was performed.

Build comparison preview: `NEXT_PUBLIC_REVIEW_PREVIEW=true npm run build`.

Run comparison coverage: `PLAYWRIGHT_REVIEW_PREVIEW=true PLAYWRIGHT_PREVIEW_ORIGIN=http://127.0.0.1:4194 PREVIEW_PORT=4194 npm run test:e2e`.

Ordinary `npm run build` omits comparison UI. Browser tests without `PLAYWRIGHT_REVIEW_PREVIEW` assert that the comparison controls are absent while exercising the approved layout.
