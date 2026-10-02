# Issue #5: seven initial Day Cards and a borderless load-more card

The existing carousel shipped in PR #13 on September 20. The October 2 clarification adds runtime behavior in this branch: initially show Today plus six days, followed by an eighth slot that uses the same Card component and occupies the same width/height. Its border, background and shadow are removed; there is no heading. One centered button says “Load seven more days.”

Selecting that button adds the next seven civil dates and selects the first newly added day. The loaded date count becomes 14, then 21, and so on. The borderless card moves to the end. The extra slot is available only when all seven dates of the next week are covered by the downloaded agenda. Once that coverage is exhausted it disappears rather than claiming unavailable days can be loaded. Loading reveals already imported data; it adds no new calendar API request.

Date cards remain contiguous Pacific civil dates across DST, month and year boundaries. Keyboard arrows, dots, pointer dragging, touch swipes, responsive centering and Return to Today work with the expanded range. Loading moves keyboard focus back to the carousel and announces the selected day and new date count. Dots wrap within the page width for longer ranges. The borderless slot has its own navigation dot and is not counted as a dated schedule card.

Deterministic browser inputs exercise whole-week coverage and busy/empty days independently of changing live feed contents. Those inputs are confined to tests. Product builds and screenshots use the normal public calendars.

Validation: lint and type checks; 68 application tests; production export (40 files); 53 Chromium checks including 320/393/1440px loading, year rollover, exhausted/partial coverage, nested vertical scrolling, navigation and Pacific midnight rollover. Quality checks run again on GitHub for the final commit.

Review the initial seven date cards and the eighth slot, load a week, then use Return to Today. No production publication is part of this branch.
