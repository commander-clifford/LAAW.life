# Issue #3: event-aware Today themes

Today can use a trivia or bingo style when an explicitly configured event occurs on its Pacific civil date. Future cards remain neutral. Metadata rules from issue #7 define eligibility, theme and priority; event-name guessing is not performed in the browser.

The initial reviewed candidates recognize Lucky Guess Trivia, the current calendar title `@Luckyguesstrivia`, and the known Thrift Store Bingo host/title variants. The machine handle displays as “Lucky Guess Trivia.” Candidate priorities are trivia 100 and bingo 80; these are editable engineering defaults for review, not a claim about venue policy. A stable UID override can disable or change one event without editing a general title rule.

The highest enabled priority wins. Equal priorities select the earliest start, then stable event identity, independent of source order. Disabled events and events on other dates do not qualify. Unavailable Today data stays neutral.

Styles use a restrained blue trivia accent or green bingo accent, with readable light/dark date and event text. These are proposed product palettes, not asserted official brand designs. All dates, Today labels and daily listings remain. The winning event receives a subtle text accent, and an accessible description announces the featured event. Styling changes no card height or schedule capacity; busy-day scrolling and fades remain in place.

Review screenshots labeled deterministic examples use test-only event inputs to make both themes easy to compare. Normal product builds use public calendar data and reviewed rules. No synthetic example events are included in production data.

Validation: lint, type checks, 81 application tests, production static build (41 files), 60 Chromium checks across the complete branch suite. Dedicated light/dark 320/1280px examples check all date-label/title contrast against 4.5:1, equal heights, preserved busy events, neutral future cards, Return to Today, competing priorities and metadata refresh.

Dependencies: issue #4's imported range and issue #7's metadata. Review those drafts before this theme-specific commit. Human visual and screen-reader review remain before a release decision. No merge or production deployment is included.
