# LAAW.life combined review candidate

Local branch: `codex/release-review-preview`. This candidate combines issue drafts for #3, #4, #5, #7, #8 and #11. Production publication, issue closure, hosting activation and merges are pending human approval.

Review hub: http://127.0.0.1:4199/

Ivy preview: http://127.0.0.1:4194/ivy/?eventLayout=title-first

Hawthorne preview: http://127.0.0.1:4194/hawthorne/?eventLayout=title-first

## Current scope

- #3: configured trivia/bingo Today themes; deterministic screenshots are test examples, not invented production events.
- #4: title/detail search across imported past and upcoming events; a standalone magnifier field and optional scope bubble for hover, keyboard and touch. The outer card, visible heading and always-visible range line are removed. Existing chronological order remains, including historical results.
- #5: seven initial dated cards and a same-size transparent Card rendered as one native button. Its entire surface loads seven more dates. Full-week coverage, final-week selection, gestures and keyboard focus are checked.
- #6: food menu system deferred behind its traffic gate.
- #7: catalog and reviewed metadata foundation. Full admin editing remains unimplemented.
- #8: stable calendar loading/recovery states, retry and Google link. Google embed internals remain outside this audit.
- #10: proposed shared date float deferred; original animation retained and issue open.
- #11: title-first rows with right-aligned times approved. Comparison controls remain preview-only.
- #12: hosting comparison/workflow prepared but inactive; account setup and activation require review.

## Verification

Lint and type checks pass. All 82 unit tests pass. Static export verifies 41 files. The carousel/layout candidate passed 92 distinct browser checks before the final search presentation update: 32 passed in the full run and the remaining 60 passed on recheck after aligning test expectations with the approved design. The application source was unchanged between those checks. The standalone search update then passed 17 bounded browser checks, including integration with loading weeks, live search, responsive alignment, clearing and keyboard/touch scope disclosure. Twelve scoped axe scans also reported zero violations. Other settled application features were preserved.

The 64 axe scans report no violations across phone/desktop, light/dark, Ivy/Hawthorne, default/comparison URLs, loaded weeks, search and controlled calendar states. Direct keyboard, mouse, touch, surface and focus checks supplement the scans. Measured normal date/title/time contrast is at least 6.24:1 in light and 5.36:1 in dark; placeholder contrast in that pre-search-update check was 7.69:1 and 8.59:1. The latest standalone field uses the existing muted text color against the card surface and passed its scoped contrast scans. These measurements exclude partially clipped/faded text at scroll edges.

Manual review still includes actual screen-reader listening, spoken time descriptions and the cross-origin Google Calendar content. This is validation toward WCAG 2.2 AA, not certification. No additional investigation or changes to the time-label detail are planned before human review.

Build comparison preview: `NEXT_PUBLIC_REVIEW_PREVIEW=true npm run build`.

Run comparison coverage: `PLAYWRIGHT_REVIEW_PREVIEW=true PLAYWRIGHT_PREVIEW_ORIGIN=http://127.0.0.1:4194 PREVIEW_PORT=4194 npm run test:e2e`.

Ordinary `npm run build` omits comparison UI. Browser tests without `PLAYWRIGHT_REVIEW_PREVIEW` assert that the comparison controls are absent while exercising the approved layout.
