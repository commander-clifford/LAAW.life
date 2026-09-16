# Publish and roll back laaw.life

## Production target

`https://laaw.life/` is served by HostGator Apache. The current V2 site has the
Option 4 layout, both location pages, and GA4 analytics; the preserved original
single-file page is at `/og/` without analytics. On September 16, public HTML
for `/`, `/ivy/`, and `/hawthorne/` matched the deployed analytics-enabled export
byte-for-byte, and `/og/` retained its original hash. See the
[V2 closeout record](release-2026-09-16-v2.md).

The September 15 observation that the homepage matched the original single-file
HTML was made **before** the initial V2 upload. It is historical evidence, not a
description of the current homepage or the backup to use for a later rollback.
The [initial release record](release-2026-09-15.md) retains that publication's
archive hash and subsequent Apache correction.

GitHub Pages at `https://commander-clifford.github.io/LAAW.life/` is a separate
preview. A Pages deployment or a GitHub tag/release does not update HostGator;
none of the workflows publishes the full production website.
Keep the current domain and build for the domain root (`PAGES_BASE_PATH` empty).

## Prepare a reviewed release

1. Finish the engineering and screenshot-based design reviews in the current
   working checkout, retaining its existing changes. Commit and push the
   reviewed production source to GitHub before uploading its output.
2. Use Node.js 24 and preserve the production analytics ID while clearing
   preview-specific settings:

   ```sh
   npm ci
   python3 -B -m unittest discover -s scripts/tests -p 'test_*.py'
   env -u PAGES_BASE_PATH -u NEXT_PUBLIC_BASE_PATH \
     -u NEXT_PUBLIC_CALENDAR_AGENDA_URL -u PLAYWRIGHT_BASE_PATH \
     -u PLAYWRIGHT_PREVIEW_ORIGIN -u PREVIEW_BASE_PATH \
     NEXT_PUBLIC_GA_MEASUREMENT_ID=G-6YWHB69NED npm run release:check
   npm run calendar:check-public
   ```

   Install Chromium with `npx playwright install chromium` if needed. Confirm
   the generated agenda includes the next business day's expected events in
   Pacific time. The GA4 ID is public; omitting it removes the tag from a new
   build. Follow the [analytics guide](google-analytics.md) for verification.
3. Package the same, unchanged export:

   ```sh
   node scripts/package-hostgator-release.mjs /tmp/laaw-life-release-YYYY-MM-DD.tar.gz
   tar -tzf /tmp/laaw-life-release-YYYY-MM-DD.tar.gz
   ```

   The package contains the **contents of `out/`** at its root, including
   `.htaccess`, `_next/`, both location routes, `404.html`, and `og/index.html`.
   A SHA-256 sidecar identifies the archive. The script rejects a Pages-prefixed
   export, a changed OG page, missing assets, or an existing destination file.
   Replace the date placeholder and use a new filename for each artifact.
   Never upload `.next/`, source, dependencies, or the archive itself into the
   public document root.

## Upload through the existing HostGator account

1. Pause scheduled calendar uploads with `FTP_CALENDAR_REFRESH_ENABLED=false`.
   Wait for any active refresh to finish and avoid manual refreshes during the
   full-site upload. The calendar-only FTP account cannot publish the full site.
2. Confirm the document root configured specifically for `laaw.life` in
   HostGator. Do not infer it from the account's primary domain. Use the existing
   authenticated connection or file manager. HostGator documents
   [explicit FTPS over TLS on port 21](https://www.hostgator.com/help/article/secure-ftp-sftp-and-ftps).
   Verify this account's FTP hostname, TLS certificate, and exact domain
   directory before uploading; keep credentials out of
   commands, files, logs, and source control.
3. Download a dated backup of that complete document root, including hidden
   files and the existing `.htaccess`, to a location outside public hosting.
   Record the domain root and the backup location. Inspect existing rewrite,
   HTTPS, and host-specific rules before replacing them. Preserve necessary
   host rules, but remove the old catch-all that serves the homepage for every
   path. The supplied `.htaccess` is a root-domain Apache static-site baseline,
   not proof that the host permits every override.
4. Extract the release locally, or stage it **outside the live document root**
   using the host's file manager. Enable hidden-file visibility. Upload all
   `_next/` assets first, then the route files and `og/`. Upload HTML/payload
   files as a coordinated release and the homepage last. Prefer a host-supported
   atomic directory switch when available; file-by-file FTP is not atomic, so
   keep this interval short. Do not delete unrelated domain verification or
   host-managed files. Retain old hashed `_next` assets through the rollback
   window for visitors with an already-open page.
5. Activate the reviewed Apache configuration only after the route files are
   present. `DirectorySlash On` resolves `/ivy`, `/hawthorne`, and `/og` through
   their trailing-slash directories. `ErrorDocument 404 /404.html` returns the
   designed missing-page response with a 404 status. Disable inherited fallback
   handling; a missing URL must not return the homepage with status 200.

## Verify the public release

- Request `/`, `/ivy/`, `/hawthorne/`, `/og`, `/og/`, and a new nonexistent URL.
  Verify HTTPS, route content, status codes, and CSS/JavaScript MIME types.
- `/og` must resolve publicly to the original page. After following redirects,
  its raw response SHA-256 must be
  `89498f5e44981f74607672dbfffb8c98800e20c5d36b350590b73c2d5ede343f`.
  Its source is `ebaef508f02993c7d3747cc3ce276fda6ff7a592:index.html`, also
  identical to `09a21f415c2483ee251b6d0195f11733cf5b1140:dist/index.html`.
  It has inline CSS and absolute Google Calendar URLs, requiring no local
  companion assets. Preserve it unaltered, including its historic calendar
  configuration; the v2 calendar configuration is separate.
- Check both calendars anonymously on a narrow and a wide viewport. Confirm
  the subtle footer OG link opens the original document, keyboard navigation
  works, and the current Pacific date and expected events are visible.
- Verify the modern pages retain `G-6YWHB69NED` and follow the
  [analytics verification guide](google-analytics.md). Keep `/og/` uninstrumented.
- Confirm the calendar refresh process updates **HostGator** before calling
  freshness complete. The GitHub Pages refresh workflow alone cannot update
  this domain. Follow [calendar refresh setup](calendar-refresh.md), then record
  the active schedule, latest successful update, and a recovery path; static
  builds contain a finite agenda window.

Scheduled production refresh was verified by
[run 35090646732](https://github.com/commander-clifford/LAAW.life/actions/runs/35090646732)
on September 16. After a full-site upload, resume the previously enabled
schedule only once the site and compatible JSON verify. The target is every
30 minutes; GitHub may delay execution.

## Rollback

If routes, assets, or calendars fail after the switch, pause the calendar
updater and wait for active runs to finish. Restore the saved pre-update live
document-root contents and `.htaccess` through the same authenticated
connection (or switch back to the backed-up directory). Restore prior HTML and
its assets together. Verify the routes and calendars present in the saved
release; for V2 this includes `/`, both location routes, `/og/`, the missing-page
response, and calendar JSON. Compare restored files with the saved pre-release
hashes. Remove only files added by the failed release using its archive listing;
retain unrelated host files.
Resume the previously enabled updater only after verifying compatibility with
the restored site. Do not reset the working checkout to perform a hosting rollback.

The `v1.0.0` Git tag is the older Next.js/GitHub Pages conversion, so it is not
the authoritative production backup. Use the complete live backup made before
this update; the historic original-site backup applies only to that older release.

Apache reference: [directory indexes and trailing slashes](https://httpd.apache.org/docs/2.4/mod/mod_dir.html),
[custom error documents](https://httpd.apache.org/docs/2.4/mod/core.html#errordocument).
