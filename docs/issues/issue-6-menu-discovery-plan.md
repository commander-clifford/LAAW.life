# Issue #6: food-menu decision and staged plan

Status: scoped and deliberately deferred. The issue's explicit gate is enough scene/vendor traffic to justify menu discovery or venue accounts. That gate has not been verified. This draft adds no scraper, menu database, login, or claim that a vendor currently offers a particular item.

## Recommended first step when the gate is met

Use the event catalog from issue #7 to attach an official venue/vendor menu URL to a stable event identity. Show a direct, clearly attributed menu link after a person verifies the source, before investing in automatic discovery. Keep calendar events usable when a menu is missing. Do not copy a stale menu into the schedule or imply that its prices, hours or items are current.

Before implementation, review analytics for the actual audience size and repeat vendor interest; choose a small pilot and a measurable success criterion with the owner. No traffic threshold or conversion target is invented in this draft. A menu link request or repeated vendor participation can inform that decision, but it is not evidence that the current gate has been met.

## Data and freshness

A later menu record should identify the vendor, source URL, source owner, verification date and optional expiry. Link only to the verified source and mark outdated/unverified menus clearly. A changed calendar event title must not move a menu to a different vendor. Use catalog identity overrides rather than title-only fuzzy matching for vendors with similar names. Removed vendors and revoked source permissions need a clear removal path.

## Later phases

1. Official menu links managed through reviewed catalog metadata, with an owner-verified pilot.
2. Discovery suggestions from official vendor/location pages, queued for human verification. Honor source permissions and avoid paid APIs until their cost is approved.
3. Authorized venue editing only if link maintenance becomes a demonstrated burden. Define venue ownership checks, account recovery, moderation and removal before creating accounts or storing menu submissions.

Each phase is a separate implementation decision. Avoid building the third phase before learning whether the first is useful.

## Review outcome

The review hub marks this issue “Deferred — traffic gate,” not “menu system implemented.” Keep the GitHub issue open. This planning PR can be accepted independently of shipping a menu feature. No screenshot is applicable because the product UI is intentionally unchanged.
