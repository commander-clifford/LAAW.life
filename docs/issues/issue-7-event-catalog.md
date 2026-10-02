# Issue #7: event catalog and repository-managed metadata

This branch adds a JSON catalog that refreshes with the calendar import, plus reviewed metadata rules in `config/event-metadata.json`. It depends on issue #4's complete imported range. The original issue deferred a full admin system; this implements the reusable data foundation and local inspection path without adding accounts or a database. A browser admin editor remains a separate product decision.

Run `npm run calendar:generate` or a normal build. Inspect `.calendar-data/event-catalog.json`. The catalog is outside `public/` and `out/`, so site visitors are not given an admin surface. A failed feed import prevents generation from completing. The same generation script runs during scheduled calendar refreshes, but this branch adds no new upload or archive destination. Scheduled run files are ephemeral. A persistent hosted catalog or Actions artifact needs an approved destination; local generation is the durable inspection path in this draft.

Each entry has a stable key, original source titles, source names, location IDs, optional metadata, and every imported occurrence with start/end dates. Feed identity plus the original calendar UID identifies an event; the occurrence timestamp is removed. Renaming a source title preserves a UID override. Different calendar UIDs remain separate even when their titles match. Multi-day instances retain all covered dates. Removed source events disappear from the current catalog; permanent audit history is not implemented.

## Editing metadata

Use `eventOverrides` with a catalog key for a precise match. `titleRules` matches an exact title after case/whitespace normalization and is useful for known recurring names with multiple UIDs. A UID override takes precedence; it does not silently merge with a title rule.

```json
{
  "version": 1,
  "tagAliases": { "quiz": "trivia" },
  "eventOverrides": {
    "feed-id:original-uid": {
      "displayName": "Readable event name",
      "url": "https://example.org/official-event",
      "tags": ["trivia"],
      "takeover": { "enabled": true, "theme": "trivia", "priority": 100 }
    }
  },
  "titleRules": {}
}
```

Tags are trimmed, lowercase, deduplicated, and optionally mapped through one-level aliases to canonical tags. Alias cycles and duplicate normalized title rules fail generation. Links must use HTTP/HTTPS without embedded credentials. Takeovers require an explicit enabled flag, a supported trivia/bingo theme, and an integer priority from 0 to 1000. No metadata rules are enabled by default in this branch. Issue #3 implements the theme presentation and competition rules.

Metadata changes follow the normal reviewed branch/PR process. Normal generation applies display names to agenda entries while preserving the original source names in the catalog. Event links and tags are stored for future use; this branch does not automatically add external links, badges, or menu claims to Day Cards.

## Review

Check the generated catalog's coverage and source failure counts before editing a key. Compare an enriched agenda with its original catalog titles. Unit checks cover recurring identities, renamed source titles, UID overrides, normalized tags, invalid links/aliases, and remote metadata validation. The full existing browser suite also runs on this branch. The review hub supplies a read-only local catalog snapshot; it does not save metadata changes.
