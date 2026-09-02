# LAAW Life

LAAW Life is a statically exported Next.js application that presents the
configured calendars for one tenant. The current page intentionally preserves
the original prototype's appearance and behavior.

## Project structure

- `app/` contains the Next.js page shell.
- `src/config/laaw-life.ts` is the current tenant and location catalog.
- `src/domain/site.ts` defines tenant, location, and calendar-source records.
- `src/application/ports.ts` defines replaceable application boundaries.
- `src/infrastructure/` contains today's checked-in catalog and Google Calendar
  embed adapter.
- `src/components/calendar-site.tsx` renders every configured location.

Add a future location by appending one typed record to the `locations` array in
`src/config/laaw-life.ts`. Preferences, identity, a database, and a CMS are not
active in this version; their boundaries are kept small until those features
have concrete requirements.

## Commands

```sh
npm run dev
npm test
npm run typecheck
npm run build
```

The production build is a static export in `dist/`, matching the existing Sites
hosting configuration.
