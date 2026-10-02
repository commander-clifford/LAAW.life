# Issue #4 — search downloaded events

Search covers event titles, descriptions, locations and source/calendar names. Words are matched without case sensitivity and all entered words must occur. Results sort chronologically and render 50 at a time; Show more expands the list. Details are plain text, never executable source markup.

The downloader now keeps historical explicit events and extends through the latest explicit or finite recurring occurrence, with at least the existing yesterday/+35-day range. Infinite recurrence is expanded only through that finite downloaded horizon. The UI states the latest date using plain language. Safety limits reject ranges over 100 years, finite recurrence counts at 20,000 and total instances over 50,000 rather than silently truncating. A failed feed is reported as partial search data.

The existing calendar-refresh JSON endpoint is reused, and the export verifier now checks a valid contiguous range that includes required coverage rather than assuming exactly 37 dates. The upload size limit remains 10 MB.

Validation: lint/type checks, 70 application tests including historical/descriptive search and multi-day finite recurrence, verified static export (41 files), and seven Chromium tests covering phone/desktop description matches, result paging, escaped source text and keyboard clearing and shared page margins at 320/393/600/1440px.

Preview: http://127.0.0.1:4184/ivy/ (local issue #4 branch). Human review and production release are separate.
