# Issue #8 — calendar loading and recovery

The lazy calendar disclosure now reserves the same frame and recovery area for loading, slow, failed, and loaded states. A ten-second delay offers waiting, Reload calendar, and Open in Google Calendar. Reload replaces the frame; closing and reopening retains the already loaded frame.

Google Calendar is cross-origin. An iframe load event confirms that a frame loaded, not that Google displayed every event. The page cannot inspect empty/partial content or all network/provider failure pages. Persistent guidance and recovery actions remain available for blank or missing-event situations. The implementation does not claim to detect those conditions.

Validation: lint/type checks and 67 application tests; verified static export (41 files); three focused Chromium tests covering mobile/desktop loading, slow, synthetic frame errors, reload, stable layout, keyboard, reduced motion and existing disclosure reopening. Synthetic error/load events test our controls, not Google's internal failure handling. Manual screen-reader listening and live provider failure behavior remain human review items.

Preview: http://127.0.0.1:4188/ivy/ — local issue #8 branch, not production. Nothing deploys from this draft branch.
