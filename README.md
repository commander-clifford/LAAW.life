# LAAW Life

LAAW Life is a statically exported Next.js application that presents one
configured location calendar at a time. Visitors can switch between `/ivy/`
and `/hawthorne/`, and the root route returns them to the last location saved
on their device. Ivy Station is the first-visit default.

On wider screens, location navigation stays visible in a left sidebar. On
narrower screens, an accessible hamburger opens the same navigation as a
GSAP-animated push drawer.

## Project structure

- `app/` contains the Next.js page shell.
- `src/config/laaw-life.ts` is the current tenant and location catalog.
- `src/domain/site.ts` defines tenant, location, and calendar-source records.
- `src/application/` contains routing rules and replaceable application
  boundaries.
- `src/infrastructure/` contains today's checked-in catalog, browser preference
  store, and Google Calendar embed adapter.
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

The production build is a root-path static export in `out/`, matching the
Sites hosting configuration. Next.js keeps its internal development and build
state in `.next/`; neither cache files nor source maps are part of the hosted
artifact. The build fails if required routes are missing, source maps are
present, or known stale copy returns.

GitHub Actions runs linting, type checking, unit tests, and a root-path static
export for pull requests and releases. A successful release then creates and
browser-smoke-tests a second export with the GitHub Pages base path before it
publishes only `out/`. Manual production deployments are restricted to `main`.
Configure the repository's `main` ruleset to require the workflow's `quality`
job so pull requests cannot bypass the release gate.

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
a Google account. Test the direct link under each embed too. The deterministic
release suite verifies the app and its recovery UI; the separate live command
checks each configured feed anonymously without making Google availability a
flaky CI dependency. The private-window review remains the final human check of
Google's current access permissions and event-detail settings.
