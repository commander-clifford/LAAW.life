# Issue #11 — event-row comparison prototype

Opt in with /hawthorne/?eventLayout=title-first or eventLayout=current. The local comparison controls switch layouts without changing the selected date. Without this parameter, the existing layout remains.

Candidate titles start at the left, wrap within a flexible column, and times align right on one line. Existing time-then-title document reading order is retained. No event data, navigation logic or analytics code changes.

The schedule frame retains its 3.5 normal-row capacity, equal card heights, vertical scrolling and fades. Wrapped titles consume extra row height in either layout; a fixed count of fully visible wrapped rows is not promised.

Validation: lint/type checks, 67 application tests, verified static export (41 files), two Chromium checks at 320/1440px for non-overlap, equal heights, busy-day fades, switching, keyboard/arrow navigation and Ivy overflow. The original carousel gesture checks pass in the separate #5 verification branch; this branch changes row CSS only. A human should compare busy Saturday and long titles at phone/wide widths, including touch/pen gestures, before selecting this design.

Local prototype: http://127.0.0.1:4181/hawthorne/?eventLayout=title-first

This is a prototype for visual review. Approval is required before choosing it for a release.
