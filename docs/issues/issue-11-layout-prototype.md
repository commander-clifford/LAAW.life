# Issue #11 — approved title-first event rows

Human review on October 9 approved titles on the left and times aligned on the right. This is the default in the combined candidate. Equal card heights, the busy-day scroll window, overflow fades and the existing time-then-title document order remain. Full spoken time descriptions are retained using native text, with compact visual time spans hidden from assistive technology to avoid duplicate announcements.

Comparison controls are available only in builds made with `NEXT_PUBLIC_REVIEW_PREVIEW=true` and a `?eventLayout=title-first` or `?eventLayout=current` URL. They float outside the page flow, collapse when focus returns to the page, and support Escape. Production builds exclude the controls and use the approved layout.

Validation is recorded in `docs/release-review.md`. Visual direction is approved; overall release approval is still pending.
