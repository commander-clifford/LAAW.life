# Google Analytics (GA4)

Status (September 16, 2026): free GA4 property and web stream created; the local
production-build configuration contains the verified measurement ID. The site
integration has not yet been published and live collection is not verified.

- Analytics account: Clifford (`139887211`).
- Property: LAAW.life (`554538162`), Pacific reporting time, US dollars.
- Web stream: LAAW.life website (`15788764289`), `https://laaw.life`.
- Measurement ID: `G-6YWHB69NED` (public tag identifier, not a credential).
- Enhanced measurement: page loads, browser-history page changes, outbound clicks,
  and scrolling enabled. Site search, form, video, and download events disabled.
- The owner's new Google login has verified property-level Administrator access.
  The original administrator remains in place; no existing access was removed.

This uses standard free GA4; no paid subscription is required.

## Activate

1. In [Google Analytics](https://analytics.google.com/), select the owner's
   appropriate account. Reuse an existing LAAW.life GA4 property/web stream if
   present; otherwise create one for `https://laaw.life`, using Pacific reporting
   time. Copy its **Measurement ID** (`G-…`), not the numeric property ID.
2. Under Admin → Data streams → the web stream → Enhanced measurement, enable
   **Page views**, including browser history changes, and **Outbound clicks**.
   Automatic initial page views and history views are the only page-view
   implementation. Do not add a second Google tag, GTM tag, or route-change event.
3. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` to that verified ID in `.env.local` for the
   production build, or in its build environment. `.env.example` intentionally
   has no example ID that could accidentally collect data. Local env files are
   ignored by Git. The public measurement ID is included in the static output.
4. Follow the existing [HostGator release guide](hostgator-release.md): publish
   reviewed source to GitHub, run the release checks with this variable present,
   and publish the resulting root-path export. Changing HostGator environment
   settings alone cannot change already-built files. Keep the ID in every later
   full-site build; calendar-only refreshes do not change the tag.
5. Verify a live visit in GA4 Realtime/DebugView. Navigate between Ivy Station and
   Hawthorne and confirm one page view per navigation. Test an actual outbound
   link when the site has one, and confirm a `click` event with `link_url`.
   Use Traffic acquisition for session source/medium and Pages and screens for
   page visits. Standard reports may populate later than Realtime.

## Scope and behavior

- No ID means no tag. Invalid IDs fail early. The tag only loads in production
  builds on `laaw.life` or `www.laaw.life`; local and GitHub Pages previews cannot
  pollute live reporting, even when built with the production ID.
- GA4 receives ordinary website visit/referrer data. Advertising personalization
  and Google signals are disabled in the tag configuration. No custom user IDs,
  event titles, calendar contents, or saved location preferences are sent.
- Location navigation is measured through page views. No redundant custom click
  event is added for those links. Current calendar controls live in a Google
  Calendar iframe: the parent site's tag cannot measure clicks inside it.
- The home-page location redirect preserves campaign query parameters so links
  with UTM tags retain their source information.
- The original `/og/` page stays byte-for-byte unchanged and is not instrumented.
- This integration does not add a consent-management interface. Configure any
  required consent behavior and public privacy information before activation.
- To disable collection, clear the ID and rebuild/release the site. This does
  not delete previously collected GA4 data.

References: Google's [page-view measurement](https://developers.google.com/analytics/devguides/collection/ga4/views)
and [outbound-click measurement](https://support.google.com/analytics/answer/13566436).
