# LAAW.life

[LAAW.life](https://laaw.life/) shows the Ivy Station and Hawthorne calendars in
one simple website. It is built with React and Next.js, then exported as static
HTML, CSS, JavaScript, and calendar data. HostGator serves those files; it does
not run the application or generate the calendar data.

## What visitors see

- The first visit to `/` opens [Ivy Station](https://laaw.life/ivy/). Later visits
  open the last location selected on that browser/device. Preferences use local
  storage, with no account or sign-in requirement.
- The hamburger opens the location menu at every screen width. The drawer
  supports keyboard navigation, Escape, focus restoration, and reduced motion.
- Each location name sits above the current daily card. The published Option 4
  layout has a prominent Pacific weekday, a quieter full date, and event names
  beside their times. The card grows to the available width up to 512 px; long
  names wrap. The full Google Calendar is below it.
- The small **OG** footer link opens the [original single-file site](https://laaw.life/og/).
  Its HTML is preserved byte-for-byte, with both original calendar embeds and
  its original styling.
- Missing addresses return the branded recovery page with an HTTP 404 status.

The [September 15 release record](docs/release-2026-09-15.md) documents the live
Option 4 release, archive hash, original-page verification, and the separately
published correction for HostGator's inherited fallback rule.

## Where the website and automation run

| Place | Purpose | What updates it |
| --- | --- | --- |
| [laaw.life](https://laaw.life/) on HostGator/Apache | Public production website | A reviewed root-path static export uploaded to the site's document root |
| [GitHub Pages preview](https://commander-clifford.github.io/LAAW.life/) | Public preview of `v2-dev` | Push to `v2-dev`, or a manual Pages rebuild from `v2-dev` |
| GitHub's default `main` branch | Source for the enabled 30-minute production calendar workflow | Reviewed source changes promoted to `main` |

**Publish changes to GitHub before uploading production files.** This includes
application changes, calendar-generation changes, and Apache configuration.
Keep the tested source revision identifiable so the live files can be traced
back to it. A Pages deployment is a preview deployment; it does not publish the
HostGator site or activate production calendar refreshes.

The Pages workflow runs application checks, Python uploader tests, a root-path
release check, then a second build and browser check with the Pages base path.
Pull requests targeting `main` or `v2-dev` run quality checks without publishing.
The `github-pages` environment should allow deployments only from `v2-dev`.
See [Pages preview setup](docs/github-pages-preview.md).

### Calendar activation status

Activation checkpoint on September 15, 2026:

- The live Option 4 website and its route correction had been verified.
- The approved 30-minute interval (`023ac00`) and operating documentation
  (`7954b29`) were published to both `main` and `v2-dev`. The activation revision
  is `7954b298dbd156a1ffd41ae79fe9f5be24188d43`.
- A dedicated FTP account had been created and its access confirmed to be
  limited to the site's `calendar-data` folder.
- All three GitHub connection secrets were configured. The
  [read-only preflight](https://github.com/commander-clifford/LAAW.life/actions/runs/34957893186)
  passed, confirming the secure login and exact public-file mapping.
- The [first manual refresh](https://github.com/commander-clifford/LAAW.life/actions/runs/34958148032)
  passed generation, FTPS upload, and exact public HTTPS verification for both
  locations. Their public snapshots were generated at 10:29 UTC on September 15.
- `FTP_CALENDAR_REFRESH_ENABLED` is `true`; scheduled uploads are enabled.
  GitHub reports the workflow as active on default branch `main`. As of
  September 15 at 11:18 UTC, the first scheduled run had not appeared in the
  [workflow history](https://github.com/commander-clifford/LAAW.life/actions/workflows/refresh-ftp-calendar.yml).
- The [Pages deployment for the activation revision](https://github.com/commander-clifford/LAAW.life/actions/runs/34959908222)
  passed its quality, build, and deployment checks.

The live connection and first manual refresh are verified. The automatic
schedule is enabled; its first successful run is still awaiting verification.

## Source files and generated output

| Path | Role |
| --- | --- |
| `app/` | Next.js routes, document layout, global styles, and recovery page |
| `src/config/laaw-life.ts` | Location names, default location, and public Google Calendar sources |
| `src/domain/` and `src/application/` | Data types, routing rules, and calendar validation |
| `src/infrastructure/` | Public-calendar adapters, recurrence expansion, generated-data reader, and saved browser preference |
| `src/components/` | Header, location drawer, daily card, and full-calendar embed |
| `public/og/index.html` | Unaltered original website |
| `public/.htaccess` | Apache routing and error-page configuration |
| `scripts/` | Calendar generation, export checks, packaging, upload safeguards, and verification |
| `.github/workflows/` | Quality checks, Pages publication, and optional HostGator data refresh |
| `docs/` | Release records and operating guides |
| `.calendar-data/agendas.json` | Generated snapshot read during the Next.js build |
| `public/calendar-data/agendas.json` | The same generated snapshot prepared for public delivery |
| `out/` | Complete deployable static website, including `calendar-data/agendas.json` |
| `.next/` | Internal Next.js development/build state; never upload this directory |

Generated calendar files, `out/`, `.next/`, dependencies, and test reports are
ignored by Git. Edit the source, then regenerate the output. Do not hand-edit
`out/` as the way to change the website. The generated JSON contains both
locations in **one file**.

Adding a location also requires updating the generator/uploader validation,
release verification, and tests that currently expect Ivy Station and
Hawthorne. There is no database, CMS, or visitor identity service in this version.

## Local setup and everyday commands

Use Node.js 24 and npm, matching the GitHub workflows. Python 3.13 matches the
uploader's workflow runtime; Python is used for its checks and transfer tools.
The packaging command also uses `tar`. Run commands from the repository root.

```sh
npm ci
npx playwright install chromium
npm run dev
```

The development server is normally available at [localhost:3000](http://localhost:3000/).
`npm run dev` first generates calendar data, so it needs access to the public
Google Calendar feeds. Stop it with Ctrl+C when finished.

| Command | What it does |
| --- | --- |
| `npm run calendar:generate` | Fetches the public feeds and regenerates both JSON copies |
| `npm run lint` | Checks source style and lint rules |
| `npm run typecheck` | Generates route types, then checks TypeScript |
| `npm test` | Runs the Vitest unit tests |
| `npm run check` | Runs lint, type checking, and unit tests |
| `npm run build` | Regenerates calendars, builds `out/`, and verifies the export |
| `npm run preview` | Serves the existing `out/` at [localhost:4173](http://localhost:4173/); does not build |
| `npm run test:e2e` | Runs Chromium browser tests against `out/`, starting the preview server when needed |
| `npm run release:check` | Runs application checks, a production build/export check, and browser tests |
| `npm run calendar:check-public` | Separately checks anonymous access to the configured Google Calendars |
| `npm run calendar:fingerprint` | Calculates a public-feed fingerprint for the optional Pages refresh helper |

The Python transfer tests do not open an FTP connection:

```sh
python3 -B -m unittest discover -s scripts/tests -p 'test_*.py'
```

Build before using `preview` or running standalone browser tests. Stop an old
preview if it points at a different build or base path. The local preview checks
static routes, but it does not execute Apache's `.htaccess`; verify Apache
behavior on the live host after publication.

The export verifier checks required pages and assets, their base paths, the OG
hash, Apache configuration, and matching fresh calendar JSON for both locations.
It also rejects development files, source maps, and known stale content.

TypeScript 7 supplies the project CLI; the TypeScript 6 compatibility package
supplies the JavaScript API used by ESLint and Next.js. Before editing framework
code, follow [AGENTS.md](AGENTS.md) and read the relevant installed Next.js guides
under `node_modules/next/dist/docs/`.

## How the daily card stays current

The full Google Calendar embed and the custom daily card are two views of the
existing public calendars. Their refresh mechanisms are separate.

1. Calendar owners keep managing events in their existing Google Calendars.
2. The generator fetches the configured **public iCalendar feeds**, expands
   recurring events, and creates Pacific-time date coverage from yesterday
   through 35 days after generation.
3. A full website build bundles that snapshot and copies it into
   `out/calendar-data/agendas.json`.
4. GitHub Actions runs the generator on `main` and uses FTPS to
   replace only HostGator's `calendar-data/agendas.json`. The website's HTML,
   JavaScript, styles, and OG page are untouched by this data-only operation.
5. A visitor's browser reads the same-origin JSON on load, every five minutes,
   and when returning to the tab or regaining connectivity. It accepts valid,
   newer data and updates the custom card.

The enabled schedule targets **every 30 minutes**, at minutes 11 and 41 of each
hour. GitHub can delay scheduled jobs; generation, transfer, and the browser's
next check add time. This is a refresh target, not a guaranteed deadline after a
calendar edit. A resumed or new page also checks for updates. The displayed day
uses Pacific time, independently of the visitor's device timezone.

There is **no cron job, Node.js service, or background generator on HostGator**.
GitHub does the scheduled work; HostGator serves static files. Reading the public
feeds requires no Google Calendar ownership credentials, Google OAuth token, or
Google API key. The FTP credential authorizes only delivery of the generated
calendar JSON.

If a fetch fails, the page keeps its bundled or last successful snapshot. After
48 hours it shows a delayed-update notice; if its date coverage expires, it
explains that the daily schedule is unavailable and keeps the full calendar
below. The Google embed continues to load directly from Google.

`NEXT_PUBLIC_CALENDAR_AGENDA_URL` is an optional **build-time** override for the
JSON URL. The normal production configuration leaves it unset and uses the
HostGator file on the same domain. A different origin would need CORS. Pages
uses its own JSON copy and has no scheduled refresh; rebuild the preview to
refresh its snapshot.

## Configure and activate the calendar-only updater

Use [GitHub Actions secrets and variables](https://github.com/commander-clifford/LAAW.life/settings/secrets/actions).
Enter the dedicated FTP password directly into GitHub's secret form. Do not put
credentials in this README, source files, shell history, or shared messages.
The values below are placeholders or documented settings, not account details.

| Repository Actions secret | Value |
| --- | --- |
| `FTP_HOST` | `<verified-ftps-hostname>` — hostname only; no URL scheme, path, or port |
| `FTP_USERNAME` | `<calendar-only-ftp-username>` |
| `FTP_PASSWORD` | `<calendar-only-ftp-password>` |

| Repository Actions variable | Setting |
| --- | --- |
| `FTP_CALENDAR_DIRECTORY` | `/` for the dedicated account already verified to be restricted directly to `calendar-data` |
| `FTP_CALENDAR_ACCOUNT_ROOT` | `true` for that verified calendar-only account |
| `FTP_PORT` | `21`, or leave blank for the same default |
| `FTP_CALENDAR_REFRESH_ENABLED` | `true` for the verified production connection; keep `false` during a new setup until verification and the first refresh succeed |

The `/` above is the **FTP account's restricted view** of the calendar folder,
not the website's or server's root. For another account, verify its scope first;
the alternative is an exact existing FTP path ending in `/calendar-data` with
the account-root flag unset. Do not give the recurring updater access to the
whole website simply to avoid configuring the restricted account.

The connection uses explicit FTPS with certificate validation and encryption
for both login and file transfers. It does not support plain FTP, SFTP, implicit
FTPS on port 990, or bypassing TLS checks. See the
[complete refresh guide](docs/calendar-refresh.md) for its safeguards.

### Activation sequence

1. Confirm the reviewed workflow and generator, including the desired interval,
   are published on `main`, which remains GitHub's default branch.
2. Complete all required GitHub secrets and variables. Keep scheduled uploads
   disabled during setup.
3. In [Actions](https://github.com/commander-clifford/LAAW.life/actions), open
   **Refresh FTP-hosted calendar data**, choose **Run workflow**, select `main`,
   and choose mode **preflight**. This reads the existing file over verified
   FTPS and compares it to the public HTTPS response; it does not upload.
4. After preflight passes, run the workflow from `main` in mode **refresh** for
   the first authorized upload. This manual mode can upload even while the
   schedule-enable flag is `false`.
5. Confirm generation, upload, and public verification all pass for **both**
   locations. Then set `FTP_CALENDAR_REFRESH_ENABLED` to `true`.
6. Verify a later scheduled run succeeds. Only then record scheduled refresh
   as operational.

Each refresh validates the feeds and generated payload, uploads a unique
temporary file, verifies its byte count, then renames it over `agendas.json`.
The uploader rejects partial/old data and stops on a rename failure instead of
deleting the published file. A separate HTTPS check confirms that visitors can
receive the exact uploaded JSON, not a fallback HTML page or an older copy.

## Publish a complete website update

Use the [HostGator upload and rollback guide](docs/hostgator-release.md) alongside
the [actual release record](docs/release-2026-09-15.md). The release record captures
the production-specific routing correction that followed the initial archive.

1. Finish the source changes, tests, and review. Commit and push the approved
   source to GitHub **before** changing production. Promote calendar updater
   changes to `main`; pushes to `v2-dev` also update the public preview.
2. Pause scheduled calendar uploads during a full-site upload or rollback by
   setting `FTP_CALENDAR_REFRESH_ENABLED` to `false`; let any active refresh
   finish and avoid starting a manual refresh during the release.
3. Build and check the same source for the **domain root**, clearing preview
   base paths and custom calendar URL overrides:

   ```sh
   npm ci
   python3 -B -m unittest discover -s scripts/tests -p 'test_*.py'
   env -u PAGES_BASE_PATH -u NEXT_PUBLIC_BASE_PATH \
     -u NEXT_PUBLIC_CALENDAR_AGENDA_URL -u PLAYWRIGHT_BASE_PATH \
     -u PLAYWRIGHT_PREVIEW_ORIGIN -u PREVIEW_BASE_PATH npm run release:check
   npm run calendar:check-public
   node scripts/package-hostgator-release.mjs /tmp/laaw-life-release-YYYY-MM-DD.tar.gz
   tar -tzf /tmp/laaw-life-release-YYYY-MM-DD.tar.gz
   ```

   Replace the date placeholder and use a new archive filename each time.
   The packaging script refuses to overwrite an existing archive. A later build
   fetches newer calendar data, so its archive hash can legitimately differ.
4. Back up the complete live document root and hidden files outside public
   hosting. Preserve the current production `.htaccess`, including required
   host-specific rules, so it can be restored. Verify the destination belongs
   specifically to `laaw.life`.
5. Use the existing full-site deployment account/file manager to upload the
   **contents of `out/`**, including `.htaccess`, all `_next/` assets,
   `calendar-data/`, `ivy/`, `hawthorne/`, `og/`, and the root/404 files. The
   calendar-only FTP account cannot perform this full-site release. Do not
   upload the archive itself, repository source, `.git/`, dependencies, or
   `.next/` into public hosting. Follow the guide's staging and upload order.
6. Verify the live release as below, then resume the calendar schedule only if
   it was previously activated and is compatible with the release.

### Public verification

- Open the root, both location routes, `/og` and `/og/`, and a new nonexistent
  path. Confirm the correct content, location switching, HTTPS, working assets,
  and an actual 404 for the missing path.
- Check both locations anonymously on a narrow and wide screen. Confirm the
  current Pacific date, expected events, keyboard behavior, and the full embed.
- Confirm [the public calendar JSON](https://laaw.life/calendar-data/agendas.json)
  serves JSON for both locations and matches the uploaded snapshot. The
  workflow's verification step checks this automatically after a data refresh.
- Verify the OG page remains unchanged. Its original SHA-256 is
  `89498f5e44981f74607672dbfffb8c98800e20c5d36b350590b73c2d5ede343f`.

## Pause, recover, or roll back

- **Pause:** set `FTP_CALENDAR_REFRESH_ENABLED` to `false`. This prevents future
  scheduled uploads; it does not stop an already-running job or disable manual
  mode `refresh`. The website keeps the last published data.
- **A feed or generation check fails:** inspect the failed Actions step and the
  public calendar's sharing/access. Correct the source, then rerun `refresh`.
  A failed generation does not upload an incomplete replacement.
- **FTPS preflight or transfer fails:** check the hostname/TLS certificate,
  password secret, restricted account scope, and directory variables. The
  preflight also validates snapshot age; an old existing file can fail that
  check even when login works. Follow the refresh guide for a controlled fresh
  replacement, then rerun verification.
- **Public verification fails:** the upload may have completed. Check the
  public URL, destination mapping, and caching before declaring the update
  successful. Keep the schedule paused until both locations verify.
- **The daily card warns about delays:** inspect the latest successful Actions
  run and its `generatedAt` timestamps. The full Google Calendar remains
  available while the updater is repaired.
- **The website release fails:** pause the updater, restore the saved live
  files and `.htaccess` together, and verify the restored site. Remove only
  files added by the failed release; preserve unrelated host-managed files.
  Restore hosting from its backup without discarding source changes locally.

For a controlled one-off refresh, generate locally with
`npm run calendar:generate` and use the established secure upload connection to
replace only `public/calendar-data/agendas.json` in the verified remote calendar
folder. Generate and upload together; an old build's snapshot will age out.
Never use the real uploader merely to test its configuration: it writes remote
files when correctly configured.

The historical `v1.0.0` tag represents the earlier Next.js conversion. It is not
a substitute for a backup of the production files or the authentic OG page.

## Public calendar access

Keep the existing Google Calendars as the source of truth. Only event details
approved for anonymous visitors belong in the public feeds configured in
`src/config/laaw-life.ts`. Use public embed/iCalendar addresses, never secret
calendar URLs. Owners can review **Settings and sharing → Access permissions
for events** in Google Calendar; no ownership credentials are needed by this
website. See Google's guides to [calendar sharing](https://support.google.com/calendar/answer/37083)
and [embedding](https://support.google.com/calendar/answer/41207).
