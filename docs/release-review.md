# LAAW.life combined review candidate

Local branch: `codex/release-review-preview`. Final approved release scope: #4 V1 search, #5 load more, #8 calendar recovery and #11 title-first rows. Main approval also authorizes release. #3 event themes and #7 catalog are excluded together and reserved for one fast follow. Their original branches and draft PRs remain intact; hosting automation and issue closure are separate.

Review hub: http://127.0.0.1:4199/

Ivy preview: http://127.0.0.1:4194/ivy/?eventLayout=title-first

Hawthorne preview: http://127.0.0.1:4194/hawthorne/?eventLayout=title-first

## Current scope

- #3: excluded together with #7 for a fast follow. No event-theme selection, metadata configuration or takeover styling is part of this production release.
- #4: title/detail search across imported past and upcoming events. The standalone magnifier input fills its containing block. The information icon and popover are removed; their unchanged range text is centered below the field in small supporting type, with a 42ch maximum measure and responsive wrapping. Colors derive from the existing design tokens and meet small-text contrast. Existing chronological order remains, including historical results.
- #5: seven initial dated cards and a same-size transparent Card rendered as one native button. Its entire surface loads seven more dates. Full-week coverage, final-week selection, gestures and keyboard focus are checked.
- #6: food menu system deferred behind its traffic gate.
- #7: excluded with #3 for a fast follow. Original work is preserved in `codex/issue-7-event-catalog` / PR #21 and `codex/issue-3-event-aware-today` / PR #23. Catalog generation, metadata enrichment, output and review/admin surfaces are excluded. Search uses the calendar events directly. Full admin editing remains future work.
- #8: stable calendar loading/recovery states, retry and Google link. Google embed internals remain outside this audit.
- #10: proposed shared date float deferred; original animation retained and issue open.
- #11: title-first rows with right-aligned times approved. Comparison controls remain preview-only.
- #12: hosting comparison/workflow prepared but inactive; account setup and activation require review.

## Verification

Final four-item production candidate: lint/types and all 71 unit tests pass; all 28 FTPS safeguards pass; static export verifies 41 files. All 90 browser checks passed across the full run and the four affected rechecks after replacing a date-dependent hover assumption with a deterministic event fixture. No product code changed for that fixture correction. GitHub CI runs the complete suite again for the release PR.

The production export is built without preview flags or base paths. Event themes, catalog generation/metadata, review controls, review fixtures, proposed date handoff and event-row restructuring are excluded. Required analytics, calendar data and the legacy OG page are preserved.

Catalog and event themes remain preserved together for a fast follow in PRs #21 and #23. Other future issues remain non-blocking.

Build comparison preview: `NEXT_PUBLIC_REVIEW_PREVIEW=true npm run build`.

Run comparison coverage: `PLAYWRIGHT_REVIEW_PREVIEW=true PLAYWRIGHT_PREVIEW_ORIGIN=http://127.0.0.1:4194 PREVIEW_PORT=4194 npm run test:e2e`.

Ordinary `npm run build` omits comparison UI. Browser tests without `PLAYWRIGHT_REVIEW_PREVIEW` assert that the comparison controls are absent while exercising the approved layout.
