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
npm run dev
npm test
npm run typecheck
npm run build
```

The production build is a root-path static export in `dist/`, matching the
existing Sites hosting configuration. GitHub Actions supplies its Pages base
path only for the public GitHub Pages build.
