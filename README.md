# LAAW Life

LAAW Life is a statically exported Next.js application that presents one
configured location calendar at a time. Visitors can switch between `/ivy/`
and `/hawthorne/`, and the root route returns them to the last location saved
on their device. Ivy Station is the first-visit default. Each location page
groups its name, current Pacific date, and daily agenda in one compact card
above the full Google Calendar embed. The card sizes to its content, with
location/date beside the events on desktop and stacked above them on mobile.

At every screen width, the hamburger opens location navigation in an accessible
GSAP-animated push drawer. The closed drawer reserves no sidebar space.

## Project structure

- `app/` contains the Next.js page shell.
- `src/config/laaw-life.ts` is the current tenant and location catalog.
- `src/domain/site.ts` defines tenant, location, and calendar-source records.
- `src/application/` contains routing rules and replaceable application
  boundaries.
- `src/infrastructure/` contains the static catalog, generated-agenda reader,
  browser preference store, and Google Calendar adapters.
- `src/components/` contains the shared layout pieces and location calendar.

Add a future location by appending one typed record to the `locations` array in
`src/config/laaw-life.ts`. Preferences remain device-local; identity, a
database, and a CMS are not active in this version.

## Commands

```sh
npm ci
npx playwright install chromium
npm run dev
npm run lint
npm test
npm run typecheck
npm run check
npm run build
npm run test:e2e
npm run calendar:fingerprint
npm run calendar:generate
npm run calendar:check-public
npm run release:check
```

`release:check` is the local go/no-go command. It runs linting, route-aware
TypeScript checks, unit tests, a production export verification, and the
Chromium smoke suite.

TypeScript 7 supplies the fast project CLI while Microsoft's TypeScript 6
compatibility package supplies the JavaScript API still required by ESLint and
Next.js tooling. Both are intentional until the lint ecosystem supports the
TypeScript 7 API.

The production build is a root-path static export in `out/` for the existing
HostGator/Apache FTP host. The Sites project and GitHub Pages are separate
deployments; publishing them does not update `laaw.life`. Next.js keeps its internal development and build
state in `.next/`; neither cache files nor source maps are part of the hosted
artifact. The build fails if required routes are missing, source maps are
present, or known stale copy returns.

The public [GitHub Pages preview](https://commander-clifford.github.io/LAAW.life/)
follows pushes to `v2-dev`. GitHub Actions runs linting, type checking, unit
tests, uploader tests, and a root-path static export, then builds and
browser-smoke-tests a second export with the Pages base path before publishing
only `out/`. Pull requests to `main` or `v2-dev` run quality checks without
publishing. Manual preview rebuilds must select `v2-dev`; the `github-pages`
environment must allow only that branch, so older workflows on `main` cannot
replace the preview. See [Pages preview setup](docs/github-pages-preview.md).
This does not publish the HostGator site or activate its FTPS refresh.

## Daily schedule freshness

The daily schedule reads each configured public iCalendar feed during the static
build, expands recurring events, and includes a rolling 35-day window. The
browser selects the current Pacific date from that window, so the date changes
without waiting for the embedded calendar.

The browser also reads `/calendar-data/agendas.json` on load, every five minutes,
and when a visitor returns to the tab. It accepts validated newer data, keeps
the bundled or last successful snapshot during failures, and indicates when
the snapshot is more than 48 hours old. Expired date coverage falls back to the
full Google Calendar embed. The optional `NEXT_PUBLIC_CALENDAR_AGENDA_URL`
build variable can override the same-origin feed; cross-origin sources need CORS.

The recommended FTP-hosted update path is the opt-in GitHub Actions FTPS
workflow that refreshes only this JSON file on HostGator. It stays disabled
until the account and exact upload directory are configured. See
[calendar refresh setup](docs/calendar-refresh.md). Pages calendar data refreshes
when `v2-dev` is pushed or its preview is rebuilt manually. Scheduled Pages
refresh is currently inactive: `main` remains the default branch and has no
calendar-refresh dispatcher. Pages refreshes do not update the FTP-hosted copy.

The authentic original single-file site is preserved unchanged at `/og/`,
linked by the small `OG` footer link. See the
[HostGator upload and rollback guide](docs/hostgator-release.md) for the
review, backup, upload, and public verification steps.

## Calendar publishing checklist

The calendar source URLs in `src/config/laaw-life.ts` are public website data.
Only calendars and event details approved for anonymous visitors belong there.
For every owned calendar feed, use Google Calendar's **Settings and sharing →
Access permissions for events → Make available to public** setting and choose
the event-detail level intentionally. Use the public embed address from
**Integrate calendar**; never check in a secret iCal address. Google Workspace
administrators can restrict public sharing. See Google's documentation for
[sharing calendars](https://support.google.com/calendar/answer/37083) and
[embedding calendars](https://support.google.com/calendar/answer/41207).

Before a release, run `npm run calendar:check-public`, then open `/ivy/` and
`/hawthorne/` in a private browser window and confirm that events render without
a Google account. The deterministic
release suite verifies the app and its recovery UI; the separate live command
checks each configured feed anonymously without making Google availability a
flaky CI dependency. The private-window review remains the final human check of
Google's current access permissions and event-detail settings.
